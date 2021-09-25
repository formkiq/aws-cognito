/**
 *
 * Custom Message for Cognito User Signup.
 * 
 */
const AWS = require('aws-sdk');
var ssm = new AWS.SSM();
var s3 = new AWS.S3();
var defaults = {};
defaults["CustomMessage_SignUp"] = {};
defaults["CustomMessage_ForgotPassword"] = {};
defaults["CustomMessage_AdminCreateUser"] = {};

defaults["CustomMessage_SignUp"]["Subject"] = "Your Verification Link";
defaults["CustomMessage_SignUp"]["Message"] = "Thank you for signing up. <a href=\"${link}\" target=\"_blank\">Click this link to verify</a>";

defaults["CustomMessage_ForgotPassword"]["Subject"] = "Your Reset Password link";
defaults["CustomMessage_ForgotPassword"]["Message"] = "You have requested a password reset. <a href=\"${link}\" target=\"_blank\">Click this link to Reset Password</a>";

defaults["CustomMessage_AdminCreateUser"]["Subject"] = "Your Account has been Created";
defaults["CustomMessage_AdminCreateUser"]["Message"] = "Your account has been created. <a href=\"${link}\" target=\"_blank\">Click this link to finalize your account.</a>";

exports.lambdaHandler = async (event, context, callback) => {

    console.log(JSON.stringify(event));

    if (process.env.TEST) {
        ssm = new AWS.SSM({
            region: 'us-east-1',
            endpoint: 'http://localhost:4566'
        });

        s3 = new AWS.S3({
            endpoint: 'http://localhost:4566',
            s3ForcePathStyle: true
        });
    }

    return getParameter(event).then((data) => {

        return getS3Files(event).then((s3data) => {

            var message = s3data;

            let urlCache = data.Parameters.find(o => o.Name.endsWith("CognitoHttpApiUrl"));
            var subject = data.Parameters.find(o => o.Name.endsWith("Subject"));

            // var message = data.Parameters.find(o => o.Name.endsWith("Message"));
            // var message = 

            if (subject === undefined) {
                subject = defaults[event.triggerSource]["Subject"];
            } else {
                subject = subject.Value;
            }

            if (message === undefined || message.length == 0) {
                message = defaults[event.triggerSource]["Message"];
            }

            if (event.triggerSource === "CustomMessage_SignUp") {
        
                const { codeParameter } = event.request;
                const { userName, region } = event;
                const { clientId } = event.callerContext;
                const { email } = event.request.userAttributes;

                const userStatus = event.request.userAttributes['cognito:user_status'];
        
                const link = `${urlCache.Value}/confirmSignUp?userStatus=${userStatus}&code=${codeParameter}&username=${userName}&clientId=${clientId}&region=${region}&email=${email}`;

                event.response.emailSubject = subject;
                event.response.emailMessage = processMessage(event.request.userAttributes, message, link);

            } else if (event.triggerSource === "CustomMessage_ForgotPassword") {

                const { codeParameter } = event.request;
                const { userName, region } = event;
                const { clientId } = event.callerContext;
                const { email } = event.request.userAttributes;
                
                const userStatus = event.request.userAttributes['cognito:user_status'];
        
                const link = `${process.env.REDIRECT_URI}/change-password?userStatus=${userStatus}&code=${codeParameter}&username=${userName}&clientId=${clientId}&region=${region}&email=${email}`;

                event.response.emailSubject = subject;
                event.response.emailMessage = processMessage(event.request.userAttributes, message, link);

            } else if (event.triggerSource == "CustomMessage_AdminCreateUser") {
        
                const { codeParameter, usernameParameter } = event.request;
                const { region, userName } = event;
                const { clientId } = event.callerContext;
                const { email } = event.request.userAttributes;

                const userStatus = event.request.userAttributes['cognito:user_status'];
        
                const link = `${urlCache.Value}/confirmRegistration?userStatus=${userStatus}&code=${codeParameter}&username=${userName}&clientId=${clientId}&region=${region}&email=${usernameParameter}`;

                event.response.emailSubject = subject;
                event.response.emailMessage = processMessage(event.request.userAttributes, message, link);
            }

            console.log(JSON.stringify(event.response));
            
            callback(null, event);
            return event;
        });

    }).catch((err) => {
        console.log(err);
    });
};

function processMessage(userAttributes, message, link) {
    const { email } = userAttributes;
    let emailLocal = email.substring(0, email.indexOf("@"));
    return message.replace("${link}", link).replace("${email}", email).replace("${emailLocal}", emailLocal);
}

async function getParameter(event) {
    return ssm.getParameters({Names:["/formkiq/cognito/" + process.env.DOMAIN + "/CognitoHttpApiUrl", 
        "/formkiq/cognito/" + process.env.DOMAIN + "/" + event.triggerSource + "/Subject"
    ]}).promise();
}

async function getS3Files(event) {
    var params = {
        Bucket: process.env.S3_BUCKET,
        Key: "formkiq/cognito/" + process.env.DOMAIN + "/" + event.triggerSource + "/Message"
    };
    
    console.log("checking for s3 file: " + JSON.stringify(params));
    
    var s3Stream = s3.getObject(params).createReadStream();

    return stream2buffer(s3Stream).then((buff) => {
        let s = buff.toString('utf8');
        return s;
    }).catch((err) => {
        console.log(err);
        return "";
    });
}

function stream2buffer(stream) {

  return new Promise((resolve, reject) => {
      
    const _buf = [];

    stream.on("data", (chunk) => _buf.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(_buf)));
    stream.on("error", (err) => reject(err));

  });
}