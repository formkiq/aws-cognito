'use strict';

const AWS = require('aws-sdk');
const fs = require('fs').promises;
const app = require('../../app.js');
var assert = require('assert');

var ssm = new AWS.SSM({
    region: 'us-east-1',
    endpoint: 'http://localhost:4566',
    accessKeyId: 'asdjsadkskdskskdk',
    secretAccessKey: 'sdsadsissdiidicdsi'
});

AWS.config.update({
  accessKeyId: 'asdjsadkskdskskdk',
  secretAccessKey: 'sdsadsissdiidicdsi',
  region: 'us-east-1',
  endpoint: 'http://localhost:4566'
});

describe('Cognito', async()  => {

    before(async() => {
        process.env.TEST = true;
        process.env.DOMAIN = "test";
        
        var params = {
            Name: "/formkiq/cognito/" + process.env.DOMAIN + "/CognitoHttpApiUrl",
            Value: "http://localhost",
            Overwrite: true
        }

        await ssm.putParameter(params).promise();
    });

    it('verifies successful response', async () => {

        var text = await readFile('./tests/json/CustomMessage_AdminCreateUser.json');
        const result = await app.lambdaHandler(JSON.parse(text), {}, function() {});

        assert.equal("Your Account has been Created", result.response.emailSubject);
        assert.equal("Your account has been created. <a href=\"http://localhost/confirmRegistration?userStatus=FORCE_CHANGE_PASSWORD&code={####}&username=db1270e6-d939-4ef0-8f9b-8c5ee47100e3&clientId=CLIENT_ID_NOT_APPLICABLE&region=us-east-1&email={username}\" target=\"_blank\">Click this link to finalize your account.</a>", result.response.emailMessage);
    });
});

async function readFile(filePath) {
    return fs.readFile(filePath).then((data) => {
        return data.toString();
    });
}