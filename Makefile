
.PHONY: run local.machine local.build local.run local.stop local.delete aws.machine aws.build aws.run aws.stop aws.delete

run:
	@node upstart

local.machine:
	@docker-machine create --driver virtualbox upstart-local || true
	@VBoxManage controlvm upstart-local natpf1 'local,tcp,,3000,,3000' || true

local.build: local.machine
	@eval `docker-machine env upstart-local`; docker build -t upstart .

local.run: local.build local.stop
	@eval `docker-machine env upstart-local`; docker run -itdp 3000:3000 upstart

local.stop:
	@eval `docker-machine env upstart-local`; docker stop $$(docker ps -q) || true

local.delete:
	@docker-machine rm -f upstart-local

aws.machine:
	@read -p 'VPC ID: ' vpc ;\
	read -p 'Access key: ' accesskey ;\
	read -p 'Secret key: ' secretkey ;\
	groupid=$$(aws ec2 create-security-group \
		--group-name 'upstart' \
		--description 'Upstart' \
		--vpc-id $$vpc \
		--query 'GroupId' \
		--output text) ;\
	aws ec2 authorize-security-group-ingress \
		--group-id $$groupid \
		--protocol 'tcp' \
		--port 80 \
		--cidr '0.0.0.0/0' ;\
	docker-machine create \
		--driver amazonec2 \
		--amazonec2-access-key $$accesskey \
		--amazonec2-secret-key $$secretkey \
		--amazonec2-vpc-id $$vpc \
		--amazonec2-region 'eu-west-1' \
		--amazonec2-instance-type 't2.micro' \
		--amazonec2-security-group 'upstart' \
		upstart-aws || true
# todo: needs to deal with cname

aws.build: aws.machine
	@eval `docker-machine env upstart-aws`; docker build -t upstart .

aws.run: aws.build aws.stop
	@eval `docker-machine env upstart-aws`; docker run -itdp 80:3000 upstart

aws.stop:
	@eval `docker-machine env upstart-aws`; docker stop $$(docker ps -q) || true

aws.delete:
	@read -p 'This will delete the AWS machine. Continue? (y/n) ' a && test $$a == 'y' || exit
	@docker-machine rm -f upstart-aws
