build : clean
	npm i
	sam build
	mkdir build
	cd .aws-sam/build && zip -r ../../build/aws-cognito-v1.3.4.zip *
	
clean :
	rm -r -f build
	rm -r -f .aws-sam
