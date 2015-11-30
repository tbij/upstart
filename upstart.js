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

app.listen(Config.port)
