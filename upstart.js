const Path = require('path')
const FS = require('fs-extra')
const Express = require('express')
const BodyParser = require('body-parser')
const CookieParser = require('cookie-parser')
const Passport = require('passport')
const PassportGoogle = require('passport-google-oauth')
const JWTSimple = require('jwt-simple')
const Multer = require('multer')
const AdmZip = require('adm-zip')
const Github = require('github')
const NodeGit = require('nodegit')
const Ursa = require('ursa')
const Config = require('./config')

const cookieOptions = { maxAge: 1000 * 60 * 60 * 24 * 7 } // expires in a week

const authOptions = {
    clientID: Config.auth.clientId,
    clientSecret: Config.auth.clientSecret,
    callbackURL: 'http://localhost:3000/sign-in/authenticate'
}

const auth = new PassportGoogle.OAuth2Strategy(authOptions, (_, __, user, done) => done(null, user))

Passport.use(auth)

const app = Express()
app.use(BodyParser.urlencoded({ extended: true }))
app.use(CookieParser())
app.use(Passport.initialize())

const signin = Passport.authenticate('google', { scope: [ 'openid', 'profile', 'email' ], hostedDomain: Config.auth.domain })
const signinAuth = Passport.authenticate('google', { failureRedirect: '/sign-in', session: false })
const upload = Multer({ dest: 'temp' }).single('file')

app.use((request, response, next) => {
    const isProtected = request.path !== '/sign-in' && request.path !== '/sign-in/authenticate'
    const userToken = request.cookies['token']
    const user = userToken ? JWTSimple.decode(userToken, Config.auth.key) : null
    if (user !== null && request.method !== 'GET') { // signed in and non-GET, so require header (because of CSRF)
        const authorisation = request.headers['authorization']
        if (authorisation === undefined) response.sendStatus(400)
        else if (authorisation.replace('Bearer ', '') !== userToken) response.sendStatus(400)
        else {
            request.user = user
            next()
        }
    }
    else if (user !== null) { // signed in, so just refresh the token
        response.cookie('token', JWTSimple.encode(user, Config.auth.key), cookieOptions)
        request.user = user
        next()
    }
    else if (user === null && isProtected) response.redirect('/sign-in') // not signed in, but need to be
    else if (user === null) next() // not signed in, but going through the process
})

app.get('/sign-in', signin)

app.get('/sign-in/authenticate', signinAuth, (request, response) => {
    const userToken = JWTSimple.encode(request.user, Config.auth.key)
    response.cookie('token', userToken, cookieOptions)
    response.redirect('/')
})

app.use('/', Express.static('interface'))

app.post('/new', upload, (request, response) => {
    const name = request.body.name.replace(/[^A-Za-z0-9-]/g, '-').replace(/-+/g, '-').toLowerCase().substring(0, 100)
    const file = request.file
    if (name === null || name.length < 1 || file === null || !valid(file)) response.status(400).send('the file was not valid')
    else create(name, file, request.user)
        .then(() => response.sendStatus(201))
        .catch(() => response.status(500).send('something went wrong'))
})

app.listen(Config.port)

function valid(file) {
    const fileZip = new AdmZip(file.path)
    const directory = fileZip.getEntries().find(entry => entry.isDirectory).entryName
    const noIndex = fileZip.getEntry(directory + 'index.html') === null
    if (noIndex) return false
    return true
}

function create(name, file, user) {
    const path = createUnzipped(file)
    return createGithubRepository(name).then(remote => {
        addGithubKey(name).then(key => {
            gitInit(path)
                .then(repository => gitAddAll(repository))
                .then(repository => gitCommit(repository, user))
                .then(repository => gitBranch(repository))
                .then(repository => gitRemote(repository, remote))
                .then(repository => gitPush(repository, key))
                .then(() => removeGithubKey(key.id))
                .then(() => FS.remove(file.path))
                .then(() => FS.remove(Path.resolve(path, '..')))
        })
    })
}

function createUnzipped(file) {
    FS.mkdir(file.path + '-x')
    const fileZip = new AdmZip(file.path)
    fileZip.extractAllTo(file.path + '-x', true)
    const directory = fileZip.getEntries().find(entry => entry.isDirectory).entryName
    return Path.resolve(file.path + '-x/' + directory)
}


function createGithubRepository(name) {
    const github = new Github({ version: '3.0.0' })
    github.authenticate({
        type: 'basic',
        username: Config.git.username,
        password: Config.git.password
    })
    const config = {
        org: Config.git.organisation,
        name: name,
        has_issues: false,
        has_wiki: false
    }
    return new Promise((resolve, reject) => {
        github.repos.createFromOrg(config, (e, result) => {
            if (e) reject(e)
            else resolve(result.ssh_url)
        })
    })
}

function addGithubKey(name) {
    const key = Ursa.generatePrivateKey()
    const keyPublic = 'ssh-rsa ' + key.toPublicSsh().toString('base64')
    const keyPrivate = key.toPrivatePem().toString()
    const github = new Github({ version: '3.0.0' })
    github.authenticate({
        type: 'basic',
        username: Config.git.username,
        password: Config.git.password
    })
    const config = {
        title: name,
        key: keyPublic
    }
    return new Promise((resolve, reject) => {
        github.user.createKey(config, (e, result) => {
            if (e) reject(e)
            else resolve({ id: result.id, public: keyPublic, private: keyPrivate })
        })
    })
}

function removeGithubKey(id) {
    const github = new Github({ version: '3.0.0' })
    github.authenticate({
        type: 'basic',
        username: Config.git.username,
        password: Config.git.password
    })
    const config = {
        id: id
    }
    return new Promise((resolve, reject) => {
        github.user.deleteKey(config, (e, result) => {
            if (e) reject(e)
            else resolve()
        })
    })
}

function gitInit(path) {
    return NodeGit.Repository.init(path, 0)
}

function gitAddAll(repository) {
    return new Promise((resolve, reject) => {
        repository.openIndex()
            .then(index => {
                index.addAll().then(() => resolve(repository))
            })
            .catch(reject)
    })
}

function gitCommit(repository, user) {
    const author = NodeGit.Signature.create(user._json.name, user._json.email, Math.round(Date.now() / 1000), 0)
    return new Promise((resolve, reject) => {
        repository.openIndex()
            .then(index => {
                index.write()
                index.writeTree().then(oid => {
                    repository.createCommit('HEAD', author, author, 'Published', oid, []).then(() => resolve(repository))
                })
            })
            .catch(reject)
    })
}

function gitBranch(repository) {
    return new Promise((resolve, reject) => {
        repository.getCurrentBranch()
            .then(master => {
                NodeGit.Branch.move(master, 'gh-pages', 0).then(() => resolve(repository))
            })
            .catch(reject)
    })
}

function gitRemote(repository, remote) {
    return new Promise((resolve, reject) => {
        NodeGit.Remote.create(repository, 'origin', remote)
        resolve(repository)
    })
}

function gitPush(repository, key) {
    const config = {
        callbacks: {
           credentials: (_, user) => NodeGit.Cred.sshKeyMemoryNew(Config.git.username, key.public, key.private, '')
        }
    }
    return new Promise((resolve, reject) => {
        repository.getRemote('origin')
            .then(remote => {
                remote.push(['refs/heads/gh-pages:refs/heads/gh-pages'], config).then(() => resolve(repository))
            })
            .catch(reject)
    })
}
