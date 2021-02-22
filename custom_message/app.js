/**
 *
 * Custom Message for Cognito User Signup.
 * 
 */
const AWS = require('aws-sdk');
var ssm = new AWS.SSM();
var defaults = {};
defaults["CustomMessage_SignUp"] = {};
defaults["CustomMessage_ForgotPassword"] = {};
defaults["CustomMessage_AdminCreateUser"] = {};

defaults["CustomMessage_SignUp"]["Subject"] = "Your Verification Link";
defaults["CustomMessage_SignUp"]["Message"] = "Thank you for signing up. ${link}";

defaults["CustomMessage_ForgotPassword"]["Subject"] = "Your Reset Password link";
defaults["CustomMessage_ForgotPassword"]["Message"] = "You have requested a password reset. ${link}";

defaults["CustomMessage_AdminCreateUser"]["Subject"] = "Your Account has been Created";
defaults["CustomMessage_AdminCreateUser"]["Message"] = "Your account has been created. ${link}";

exports.lambdaHandler = async (event, context, callback) => {

    console.log(JSON.stringify(event));

    if (process.env.TEST) {
        ssm = new AWS.SSM({
            region: 'us-east-1',
            endpoint: 'http://localhost:4566'
        });
    }

    return getParameter(event).then((data) => {
            
        let urlCache = data.Parameters.find(o => o.Name.endsWith("CognitoHttpApiUrl"));
        var subject = data.Parameters.find(o => o.Name.endsWith("Subject"));
        var message = data.Parameters.find(o => o.Name.endsWith("Message"));

        if (subject === undefined) {
            subject = defaults[event.triggerSource]["Subject"];
        } else {
            subject = subject.Value;
        }

        if (message === undefined) {
            message = defaults[event.triggerSource]["Message"];
        } else {
            message = message.Value;
        }

        if (event.triggerSource === "CustomMessage_SignUp") {
    
            const { codeParameter } = event.request;
            const { userName, region } = event;
            const { clientId } = event.callerContext;
            const { email } = event.request.userAttributes;

            const userStatus = event.request.userAttributes['cognito:user_status'];
    
            const link = `<a href="${urlCache.Value}/confirmSignUp?userStatus=${userStatus}&code=${codeParameter}&username=${userName}&clientId=${clientId}&region=${region}&email=${email}" target="_blank">Click this link to verify</a>`;

            event.response.emailSubject = subject;
            event.response.emailMessage = message.replace("${link}", link);

        } else if (event.triggerSource === "CustomMessage_ForgotPassword") {

            const { codeParameter } = event.request;
            const { userName, region } = event;
            const { clientId } = event.callerContext;
            const { email } = event.request.userAttributes;
            const userStatus = event.request.userAttributes['cognito:user_status'];
    
            const link = `<a href="${process.env.REDIRECT_URI}/lostpassword?userStatus=${userStatus}&code=${codeParameter}&username=${userName}&clientId=${clientId}&region=${region}&email=${email}" target="_blank">Click this link to Reset Password</a>`;

            event.response.emailSubject = subject;
            event.response.emailMessage = message.replace("${link}", link);

        } else if (event.triggerSource == "CustomMessage_AdminCreateUser") {
    
            const { codeParameter, usernameParameter } = event.request;
            const { region, userName } = event;
            const { clientId } = event.callerContext;
            const { email } = event.request.userAttributes;

            const userStatus = event.request.userAttributes['cognito:user_status'];
    
            const link = `<a href="${urlCache.Value}/confirmRegistration?userStatus=${userStatus}&code=${codeParameter}&username=${userName}&clientId=${clientId}&region=${region}&email=${usernameParameter}" target="_blank">Click this link to finalize your account.</a>`;

            event.response.emailSubject = subject;
            event.response.emailMessage = message.replace("${link}", link);
        }

        console.log(JSON.stringify(event.response));
        
        callback(null, event);
        return event;

    }).catch((err) => {
        console.log("ERRO!: " + err);
    });
};

async function getParameter(event) {
    return ssm.getParameters({Names:["/formkiq/cognito/" + process.env.DOMAIN + "/CognitoHttpApiUrl", 
        "/formkiq/cognito/" + process.env.DOMAIN + "/" + event.triggerSource + "/Subject",        
        "/formkiq/cognito/" + process.env.DOMAIN + "/" + event.triggerSource + "/Message"
    ]}).promise();
}