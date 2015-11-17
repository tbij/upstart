function Upstart() {

    var file

    function init() {
        setupName()
        setupFile()
        setupUpload()
    }

    function setupName() {
        var name = document.querySelector('input[type=text]')
        var fragment = document.querySelector('.fragment')
        name.addEventListener('input', function () {
            var value = name.value.replace(/[^A-Za-z0-9-]/g, '-').replace(/-+/g, '-').toLowerCase().substring(0, 100)
            name.value = value
            fragment.innerHTML = value
        })
    }

    function setupFile() {
        var fileTargetText = document.querySelector('.filetarget p')
        var fileInput = document.querySelector('input[type=file]')
        fileInput.addEventListener('change', function () {
            if (fileInput.files[0].type === 'application/zip') {
                file = fileInput.files[0]
                fileTargetText.innerHTML = fileInput.files[0].name
                fileTargetText.classList.add('named')
                if (valid()) upload()
            }
            else info('Please upload a Zip file.')
        })
        var fileTargetButton = document.querySelector('.filetarget input[type=button]')
        fileTargetButton.addEventListener('click', function () {
            fileInput.click()
        })
        var fileTarget = document.querySelector('.filetarget')
        fileTarget.addEventListener('dragenter', function () {
            fileTarget.classList.add('active')
        })
        fileTarget.addEventListener('dragleave', function () {
            fileTarget.classList.remove('active')
        })
        fileTarget.addEventListener('dragover', function (e) {
            e.preventDefault()
        })
        fileTarget.addEventListener('drop', function (e) {
            e.preventDefault()
            fileTarget.classList.remove('active')
            if (e.dataTransfer.files[0].type === 'application/zip') {
                file = e.dataTransfer.files[0]
                fileTargetText.innerHTML = e.dataTransfer.files[0].name
                fileTargetText.classList.add('named')
                if (valid()) upload()
            }
            else info('Please upload a Zip file.')
        })
    }

    function setupUpload() {
        var uploadButton = document.querySelector('input[type=button].upload')
        uploadButton.addEventListener('click', function () {
            if(valid()) upload()
        })
    }

    function valid() {
        var name = document.querySelector('input[type=text]')
        var fileInput = document.querySelector('.filetarget input[type=button]')
        if (name.value === '') {
            info('Please enter a name for this interactive.')
            name.focus()
            return false
        }
        else if (file === undefined) {
            info('Please add a file to be uploaded.')
            return false
        }
        else {
            info('')
            return true
        }
    }

    function upload() {
        var inputs = [
            document.querySelector('input[type=text]'),
            document.querySelector('.domain'),
            document.querySelector('.fragment'),
            document.querySelector('.filetarget'),
            document.querySelector('.upload'),
            document.querySelector('.info')
        ]
        inputs.forEach(function (input) {
            input.style.display = 'none'
        })
        document.querySelector('.text').innerHTML = 'Uploading...'
        var progress = document.createElement('progress')
        progress.value = 0
        document.querySelector('form').appendChild(progress)
        var http = new XMLHttpRequest()
        http.open('POST', '/new', true)
	http.setRequestHeader('Authorization', 'Bearer ' + document.cookie.match(/token=(.*?)(;|$)/)[1])
        var data = new FormData()
        data.append('name', document.querySelector('input[type=text]').value)
        data.append('file', file)
        http.addEventListener('progress', function (e) {
            document.querySelector('progress')
            if (e.lengthComputable) progress.value = e.loaded / e.total
        })
        http.addEventListener('load', function () {
            document.querySelector('progress').remove()
            var location = document.querySelector('.domain').innerHTML + document.querySelector('.fragment').innerHTML
            var locationLink = document.createElement('a')
            locationLink.href = location
            locationLink.innerHTML = location
            var text = document.querySelector('.text')
            text.innerHTML = 'Done! The interactive should now be available at: '
            text.appendChild(locationLink)
            text.classList.add('done')
        })
        http.send(data)
    }

    function info(message) {
        document.querySelector('.info').innerHTML = message
    }
    
    init()
    
}

Upstart()
