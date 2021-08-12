'use strict';

const AWS = require('aws-sdk');
const fs = require('fs').promises;
const app = require('../../app.js');
var assert = require('assert');

AWS.config.update({
  accessKeyId: 'asdjsadkskdskskdk',
  secretAccessKey: 'sdsadsissdiidicdsi',
  region: 'us-east-1',
  endpoint: 'http://localhost:4566'
});

var ssm = new AWS.SSM({
    region: 'us-east-1',
    endpoint: 'http://localhost:4566',
    accessKeyId: 'asdjsadkskdskskdk',
    secretAccessKey: 'sdsadsissdiidicdsi'
});

var s3 = new AWS.S3({
    region: 'us-east-1',
    endpoint: 'http://localhost:4566',
    s3ForcePathStyle: true
});

describe('Cognito', async()  => {

    before(async() => {
        process.env.TEST = true;
        process.env.DOMAIN = "test";
        process.env.REDIRECT_URI = "http://localhost";
        process.env.S3_BUCKET = "aws-cognito";
        
        var params = {
            Name: "/formkiq/cognito/" + process.env.DOMAIN + "/CognitoHttpApiUrl",
            Value: "http://localhost",
            Overwrite: true
        }

        await ssm.putParameter(params).promise();

        await ssm.deleteParameter({Name: "/formkiq/cognito/" + process.env.DOMAIN + "/CustomMessage_AdminCreateUser/Subject"}).promise().catch(() => {});
        await s3.createBucket({Bucket: process.env.S3_BUCKET}).promise();
    });

    beforeEach(async() => {
        var params = {
            Bucket: process.env.S3_BUCKET, 
            Key: "formkiq/cognito/" + process.env.DOMAIN + "/CustomMessage_AdminCreateUser/Message"
        };
        await s3.deleteObject(params).promise();
    });

    it('CustomMessage_AdminCreateUser', async () => {

        var text = await readFile('./tests/json/CustomMessage_AdminCreateUser.json');
        const result = await app.lambdaHandler(JSON.parse(text), {}, function() {});

        assert.equal("Your Account has been Created", result.response.emailSubject);
        assert.equal("Your account has been created. <a href=\"http://localhost/confirmRegistration?userStatus=FORCE_CHANGE_PASSWORD&code={####}&username=db1270e6-d939-4ef0-8f9b-8c5ee47100e3&clientId=CLIENT_ID_NOT_APPLICABLE&region=us-east-1&email={username}\" target=\"_blank\">Click this link to finalize your account.</a>", result.response.emailMessage);
    });

    it('CustomMessage_AdminCreateUser Custom SSM', async () => {

        var params0 = {
            Name: "/formkiq/cognito/" + process.env.DOMAIN + "/CustomMessage_AdminCreateUser/Subject",
            Value: "Test Subject",
            Overwrite: true
        }
        await ssm.putParameter(params0).promise();

        var params1 = {
            Body: "Test ${email} ${link} ${emailLocal}",
            Bucket: process.env.S3_BUCKET,
            Key: "formkiq/cognito/" + process.env.DOMAIN + "/CustomMessage_AdminCreateUser/Message"
        };
        await s3.putObject(params1).promise();

        var text = await readFile('./tests/json/CustomMessage_AdminCreateUser.json');
        const result = await app.lambdaHandler(JSON.parse(text), {}, function() {});

        assert.equal("Test Subject", result.response.emailSubject);
        assert.equal("Test mfriesen@gmail.com http://localhost/confirmRegistration?userStatus=FORCE_CHANGE_PASSWORD&code={####}&username=db1270e6-d939-4ef0-8f9b-8c5ee47100e3&clientId=CLIENT_ID_NOT_APPLICABLE&region=us-east-1&email={username} mfriesen", result.response.emailMessage);    
    });

    it('CustomMessage_SignUp', async () => {

        var text = await readFile('./tests/json/signup01.json');
        const result = await app.lambdaHandler(JSON.parse(text), {}, function() {});

        assert.equal("Your Verification Link", result.response.emailSubject);
        assert.equal("Thank you for signing up. <a href=\"http://localhost/confirmSignUp?userStatus=UNCONFIRMED&code={####}&username=42575cda-2414-4ef5-8679-ed10d219d814&clientId=197cl4eouv0fcbkc60sj0n0tp2&region=us-east-2&email=mfriesen@gmail.com\" target=\"_blank\">Click this link to verify</a>", result.response.emailMessage);
    });

    it('CustomMessage_ForgotPassword', async () => {

        var text = await readFile('./tests/json/forgot01.json');
        const result = await app.lambdaHandler(JSON.parse(text), {}, function() {});

        assert.equal("Your Reset Password link", result.response.emailSubject);
        assert.equal("You have requested a password reset. <a href=\"http://localhost/lostpassword?userStatus=CONFIRMED&code={####}&username=4b2857fe-9376-4d21-bf5c-fdc1bcba291b&clientId=57cqrjqsl9e193m9r2hamagn2k&region=us-east-2&email=mfriesen@gmail.com\" target=\"_blank\">Click this link to Reset Password</a>", result.response.emailMessage);
    });
});

async function readFile(filePath) {
    return fs.readFile(filePath).then((data) => {
        return data.toString();
    });
}