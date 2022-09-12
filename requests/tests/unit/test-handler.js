'use strict';

var http = require('http');
var mockserver = require('mockserver');
const fs = require('fs').promises;
const app = require('../../app.js');
const chai = require('chai');
const expect = chai.expect;
var context;
var server;

describe('Tests index', function () {

    before(function () {
        server = http.createServer(mockserver('./requests/tests/mocks')).listen(9001);
        process.env.POOL_CLIENT_ID = "12345";
        process.env.COGNITO_DOMAIN = "http://localhost:9001/cognitodomain";
    });

    beforeEach(function () {
        process.env.REDIRECT_URI = "https://d2i952jamiey58.cloudfront.net,http://localhost:8080";
    });

    after(function () {
        server.close();
    });

    it('/login', async () => {
        let event = JSON.parse(await readFile('./requests/tests/json/login.json'));

        const result = await app.lambdaHandler(event, context);

        expect(result.statusCode).to.equal(400);
        expect(result.body).to.be.equal("{\"message\":\"missing fields 'username'\"}");
    });

    it('/login with code', async () => {
        let event = JSON.parse(await readFile('./requests/tests/json/login_with_code.json'));

        const result = await app.lambdaHandler(event, context);

        expect(result.statusCode).to.equal(301);
        expect(result.headers["Location"]).to.equal("https://d2i952jamiey58.cloudfront.net?success=false");
    });

    it('/login with code and redirect_uri', async () => {
        process.env.REDIRECT_URI = "https://d2i952jamiey58.cloudfront.net,http://localhost:4200";
        let event = JSON.parse(await readFile('./requests/tests/json/login_with_code.json'));
        event.queryStringParameters["redirect_uri"] = encodeURIComponent("http://localhost:4200/bleh")
        const result = await app.lambdaHandler(event, context);

        expect(result.statusCode).to.equal(301);
        expect(result.headers["Location"]).to.equal("http://localhost:4200/bleh?success=false");
    });

    it('/login with code and invalid redirect_uri', async () => {
        process.env.REDIRECT_URI = "https://d2i952jamiey58.cloudfront.net,http://localhost:4200123";
        let event = JSON.parse(await readFile('./requests/tests/json/login_with_code.json'));
        event.queryStringParameters["redirect_uri"] = encodeURIComponent("http://localhost:4200/bleh")
        const result = await app.lambdaHandler(event, context);

        expect(result.statusCode).to.equal(301);
        expect(result.headers["Location"]).to.equal("https://d2i952jamiey58.cloudfront.net?success=false");
    });
});

async function readFile(filePath) {
    return fs.readFile(filePath).then((data) => {
        return data.toString();
    });
}