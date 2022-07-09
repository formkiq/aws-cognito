VERSION := $(shell node -p "require('./package.json').version")

build : clean
	npm i
	sam build
	mkdir build
	cd .aws-sam/build && zip -r ../../build/aws-cognito-v${VERSION}.zip *
	
clean :
	rm -r -f build
	rm -r -f .aws-sam
