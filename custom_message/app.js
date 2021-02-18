/**
 *
 * Custom Message for Cognito User Signup.
 * 
 */
const AWS = require('aws-sdk');
const ssm = new AWS.SSM();
const s3 = new AWS.S3();
var urlCache = null;

exports.lambdaHandler = async (event, context, callback) => {

    console.log(JSON.stringify(event));
    
    return getParameter(event).then((data) => {
            
        let urlCache = data.Parameters.find(o => o.Name.endsWith("CognitoHttpApiUrl"));
        let subject = data.Parameters.find(o => o.Name.endsWith("Subject"));
        let message = data.Parameters.find(o => o.Name.endsWith("Message"));

        if (event.triggerSource === "CustomMessage_SignUp") {
    
            const { codeParameter } = event.request;
            const { userName, region } = event;
            const { clientId } = event.callerContext;
            const { email } = event.request.userAttributes;
    
            const link = `<a href="${urlCache.Value}/confirmSignUp?code=${codeParameter}&username=${userName}&clientId=${clientId}&region=${region}&email=${email}" target="_blank">Click this link to verify</a>`;

            event.response.emailSubject = subject.Value;
            event.response.emailMessage = message.Value.replace("${link}", link);

        } else if (event.triggerSource === "CustomMessage_ForgotPassword") {

            const { codeParameter } = event.request;
            const { userName, region } = event;
            const { clientId } = event.callerContext;
            const { email } = event.request.userAttributes;
    
            const link = `<a href="${process.env.REDIRECT_URI}/lostpassword?code=${codeParameter}&username=${userName}&clientId=${clientId}&region=${region}&email=${email}" target="_blank">Click this link to Reset Password</a>`;

            event.response.emailSubject = subject.Value;
            event.response.emailMessage = message.Value.replace("${link}", link);
        }
        
        console.log(JSON.stringify(event.response));
        
        callback(null, event);
        return event; 
    });
};

async function getParameter(event) {
    return ssm.getParameters({Names:["/formkiq/cognito/" + process.env.DOMAIN + "/CognitoHttpApiUrl", 
        "/formkiq/cognito/" + process.env.DOMAIN + "/" + event.triggerSource + "/Subject",        
        "/formkiq/cognito/" + process.env.DOMAIN + "/" + event.triggerSource + "/Message"
    ]}).promise();
}