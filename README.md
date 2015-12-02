Upstart
=======

A friendly tool which takes a Zip file and creates a website using Github Pages.


Running
-------

Upstart requires [SBT] (http://www.scala-sbt.org/), [Docker] (https://www.docker.com/docker-engine), [Docker Machine] (https://www.docker.com/docker-machine), and for deployment to AWS the [AWS CLI] (https://aws.amazon.com/cli/).

Before running, you will need to create a `config.json` file which includes details about the site you will be managing. The `config.example.json` shows what fields are required.

The `domain` value should list the domain at which uploaded sites will be deployed to. This will either be a Github Pages (such as `http://tbij.github.io/`), or another domain which has that as its CName.

The `auth` section sets up how Upstart should authenticate users. Upstart uses Google to do this -- anyone with an email address using the domain listed in `auth.domain` will be granted access. The `auth.key` is a secure key used to verify requests -- it can be any random secret value, such as the output of `cat /dev/urandom | base64 | head -c 64`. To get the `auth.clientId` and `auth.clientSecret` you need to create a new project in [Google Developers Console] (https://console.developers.google.com/) and [create new OAuth 2 credentials] (https://console.developers.google.com/apis/credentials). This will prompt for 'authorised Javascript origins' which should include `localhost:3000` as well as the domain you want to run Upstart on in production. The 'authorised redirect URIs' should include both URIs from the previous section, followed by `/sign-in/authenticate`.

The `git` section describes the site you will be managing. The `git.repository` should be a HTTPS link to the Git repository where your site is stored. The `git.username` and `git.password` should be for a user that has write access to that repository.

### Locally

To deploy:

	$ make local.run

The first time you run this it will take a while longer as it creates a new virtual machine. The machine created with this command can be removed with `make local.delete`.

Upstart will then be available on [localhost:3000] (http://localhost:3000/).

### On AWS

To deploy:

	$ make aws.run

This will prompt you for details about your AWS account. The first time you run this it will take a while longer as it creates a new EC2 machine. This machine can also be removed with `make aws.delete`.
