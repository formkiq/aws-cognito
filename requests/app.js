const AWS = require('aws-sdk');
const https = require('https');
const url = require('url');

const COGNITO_CLIENT = new AWS.CognitoIdentityServiceProvider({
  apiVersion: "2016-04-19",
  region: process.env.REGION
});

/**
 *
 * Cognito Request Handler.
 * 
 */
exports.lambdaHandler = async (event, context) => {

    console.info(JSON.stringify(event));
    
    let path = event.path;
    let redirectUri = getRedirectUri(event);
    
    if (path != null && event.body != null) {
      
      var body = event.body;
      if (event.isBase64Encoded) {
        let buff = Buffer.from(body, 'base64');
        body = buff.toString('utf-8');
      }

      let obj = JSON.parse(body);
      
      if (path == "/register") {
        return handleRegister(obj);
      } else if (path == "/login") {
        return login(obj, redirectUri);
      } else if (path == "/changePassword") {
        return changepassword(obj);
      } else if (path == "/forgotPassword") {
        return forgotPassword(obj);
      } else if (path == "/resetPassword") {
        return resetPassword(obj);
      } else if (path == "/refreshToken") {
        return refreshToken(obj);
      } else if (path == "/respondToAuthChallenge") {
        return respondToAuthChallenge(obj);
      } else {
        return response(400, {message: "invalid request"});
      }
    } else if (path != null && path == "/confirmSignUp") {
      return confirmSignUp(event, redirectUri);
    } else if (path != null && path == "/confirmRegistration") {
      return confirmRegistration(event, redirectUri);
    } else if (event.httpMethod == "OPTIONS") {
      return response(200, {message: "it's all good"});
    } else {
      return response(400, {message:"invalid body"});
    }
};

function confirmRegistration(event, redirectUri) {
  
  let code = event.queryStringParameters.code;
  let username = event.queryStringParameters.username;
  let userStatus = event.queryStringParameters.userStatus;
  var session = "";
  
  return login({username: username, password: code}, redirectUri).then((data) => {
    var body = JSON.parse(data.body);
    if (body.ChallengeName == "NEW_PASSWORD_REQUIRED") {
      userStatus = "NEW_PASSWORD_REQUIRED";
      session = body.Session;
    }
    
    return response(301, redirectUri + "?success=true&username=" + username + "&userStatus=" + userStatus + "&code=" + encodeURIComponent(code) + "&session=" + encodeURIComponent(session));
  }).catch((error) => {
    console.log("ERROR: " + JSON.stringify(error));
    return response(301, redirectUri + "?success=false&username=" + username + "&userStatus=" + userStatus + "&code=" + encodeURIComponent(code) + "&session=" + encodeURIComponent(session));
  });
}

function confirmSignUp(event, redirectUri) {
  
  let code = event.queryStringParameters.code;
  let username = event.queryStringParameters.username;
  let userStatus = event.queryStringParameters.userStatus;
  
  let params = {
    ClientId: process.env.POOL_CLIENT_ID,
    ConfirmationCode: code,
    Username: username
  };
  
  return COGNITO_CLIENT.confirmSignUp(params).promise().then((data) => {
    return response(301, redirectUri + "?success=true&username=" + username + "&userStatus=" + userStatus);
  }).catch((error) => {
    console.log("ERROR: " + error);
    return response(301, redirectUri + "?success=false&username=" + username + "&userStatus=" + userStatus);
  });
}

function resetPassword(obj) {
    
  let params = {
    ClientId: process.env.POOL_CLIENT_ID,
    ConfirmationCode: obj.code,
    Username: obj.username,
    Password: obj.password
  };
  
  return COGNITO_CLIENT.confirmForgotPassword(params).promise().then((data) => {
    return response(200, {message:"Password Updated"});
  }).catch((error) => {
    console.log("ERROR: " + error);
    return response(400, error);
  });
}

function handleRegister(obj) {
  let requiredFields = ["username", "password"];

  if (isValidFields(obj, requiredFields)) {

    let createGroup = obj.createNewGroup != null;
    let confirmSignUp = obj.confirmSignUp != null;

    var params = {
      ClientId: process.env.POOL_CLIENT_ID,
      Password: obj.password,
      Username: obj.username
    };

    return COGNITO_CLIENT.signUp(params).promise().then((data) => {

      var groupName = randomString(10, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
      var params = {
        GroupName: groupName,
        UserPoolId: process.env.USER_POOL_ID
      };

      return (createGroup ? COGNITO_CLIENT.createGroup(params).promise().then((data) => {

        var params = {
          GroupName: groupName,
          UserPoolId: process.env.USER_POOL_ID,
          Username: obj.username
        };

        return COGNITO_CLIENT.adminAddUserToGroup(params).promise();

      }) : Promise.resolve("")).then(() => {
        
        var params = {
          UserPoolId: process.env.USER_POOL_ID,
          Username: obj.username
        };

        return confirmSignUp ? COGNITO_CLIENT.adminConfirmSignUp(params).promise() : Promise.resolve("no confirmSignUp");

      }).then(() => {

        var params = {
          UserAttributes: [
            {
              Name: 'email_verified',
              Value: 'true'
            }
          ],
          UserPoolId: process.env.USER_POOL_ID,
          Username: obj.username
        };

        return confirmSignUp ? COGNITO_CLIENT.adminUpdateUserAttributes(params).promise() : Promise.resolve("no confirmSignUp");

      }).then((data) => {
        return response(200, {message:"User registered"});
      });

    }).catch((error) => {
      console.log("ERROR: " + error);
      return response(400, error);
    });

  } else {
    return response(400, {message: "missing fields 'username', 'password'"});
  }
}

function respondToAuthChallenge(obj) {
  let requiredFields = ["session", "password", "username", "userStatus"];

  if (isValidFields(obj, requiredFields)) {

    var params = {
      ClientId: process.env.POOL_CLIENT_ID,
      ChallengeName: obj.userStatus,
      Session: decodeURIComponent(obj.session),
      ChallengeResponses: {
        NEW_PASSWORD: obj.password,
        USERNAME: obj.username
      }
    };

    return COGNITO_CLIENT.respondToAuthChallenge(params).promise().then((data) => {
      return response(200, {message:"Change Password"});
    }).catch((error) => {
      return response(400, error);
    });

  } else {
    return response(400, {message: "missing fields 'userStatus','session','password','username'"});
  }
}

function changepassword(obj) {
  let requiredFields = ["accessToken", "password", "previousPassword"];

  if (isValidFields(obj, requiredFields)) {

    var params = {
      PreviousPassword: obj.previousPassword,
      ProposedPassword: obj.password,
      AccessToken: obj.accessToken
    };

    return COGNITO_CLIENT.changePassword(params).promise().then((data) => {
      return response(200, {message:"Change Password"});
    }).catch((error) => {
      return response(400, error);
    });

  } else {
    return response(400, {message: "missing fields 'accessToken','password','previousPassword'"});
  }
}

function getUser(username) {
  var params = {
    UserPoolId: process.env.USER_POOL_ID,
    Username: username
  };
  return COGNITO_CLIENT.adminGetUser(params).promise();
}

function fixForcePasswordChange(username) {
  return getUser(username).then((user) => {
    if ("FORCE_CHANGE_PASSWORD" === user.UserStatus) {
      var password = randomString(16, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
      var params = {
        Password: password,
        UserPoolId: process.env.USER_POOL_ID,
        Username: username,
        Permanent: true
      };
      return COGNITO_CLIENT.adminSetUserPassword(params).promise();
    } else {
      return Promise.resolve("");
    }
  });
}

function forgotPassword(obj) {
  let requiredFields = ["username"];

  if (isValidFields(obj, requiredFields)) {

    return fixForcePasswordChange(obj.username).then(() => {
      
      var params = {
        ClientId: process.env.POOL_CLIENT_ID,
        Username: obj.username
      };
  
      return COGNITO_CLIENT.forgotPassword(params).promise().then((data) => {
        return response(200, {message:"Password reset sent"});
      }).catch((error) => {
        return response(400, error);
      });

    }).catch((error) => {
      if (error.code === "UserNotFoundException") {
        return response(200, {message:"Password reset sent"});
      } else {
        return response(400, error);
      }
    });

  } else {
    return response(400, {message: "missing fields 'username'"});
  }
}

function loginOAuth2(code, redirectUri) {

  let u = url.parse(process.env.COGNITO_DOMAIN);
  let path = "/oauth2/token?grant_type=authorization_code&client_id=" + process.env.POOL_CLIENT_ID 
    + "&code=" + code + "&redirect_uri=" + redirectUri;
  
  var opts = {
      host: u.hostname,
      path: path,
      method: 'POST',
      body: '',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
      }
  };
  
  return new Promise((resolve, reject) => {
    send(opts, resolve, reject);
  }).then((data) => {
  
    let obj = JSON.parse(data);
    let o = {
      AuthenticationResult : {
        AccessToken : obj['access_token'],
        IdToken : obj['id_token'],
        RefreshToken : obj['refresh_token'],
        ExpiresIn: obj['expires_in']
      }
    };

    var opts2 = {
      host: u.hostname,
      path: '/oauth2/userInfo',
      method: 'GET',
      body: '',
      headers: {
        'Authorization': 'Bearer ' + obj['access_token']
      }
    };
  
    return new Promise((resolve, reject) => {
      send(opts2, resolve, reject);
    }).then((data) => {
      let user = JSON.parse(data);
      o.AuthenticationResult.username = user.username;
      o.AuthenticationResult.email = user.email;
      return response(200, o);
    });
    
  }).catch(() => {
    return response(301, redirectUri + "?success=false");
  });
}

function send(opts, resolve, reject) {
  const req = https.request(opts, res => {
    console.log("statusCode: " + res.statusCode);
  
    var body = '';
  
    res.on('data', chunk => {
      body += chunk;
    });
  
    res.on('end', () => {
      console.log("BODY: " + body);
  
      if (res.statusCode == 200 || res.statusCode == 201) {
        resolve(body);
      } else {
        reject({statusCode: res.statusCode, body:body});
      }
    });
  });

  req.on('error', error => {
    reject(error);
  });

  req.write(opts.body);
  req.end();  
}

function login(obj, redirectUri) {
  
  let requiredFields = ["username", "password"];
  if (isValidFields(obj, requiredFields)) {

    var params = {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: process.env.POOL_CLIENT_ID,
      AuthParameters: {
        'USERNAME': obj.username,
        'PASSWORD': obj.password
      }
    };

    return COGNITO_CLIENT.initiateAuth(params).promise().then((data) => {
      return response(200, data);
    }).catch((error) => {
      return response(400, error);
    });

  } else if (obj.code) {
      return loginOAuth2(obj.code, redirectUri);
  } else {
    return response(400, {message: "missing fields 'username'"});
  }
}

function refreshToken(obj) {
  let requiredFields = ["refreshToken"];

  if (isValidFields(obj, requiredFields)) {

    var params = {
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: process.env.POOL_CLIENT_ID,
      AuthParameters: {
        'REFRESH_TOKEN': obj.refreshToken
      }
    };

    return COGNITO_CLIENT.initiateAuth(params).promise().then((data) => {
      return response(200, data);
    }).catch((error) => {
      return response(400, error);
    });

  } else {
    return response(400, {message: "missing fields 'username'"});
  }
}

function response(statusCode, message) {

  var resp = {};
  if (statusCode == 301) {
    resp = {
      'statusCode': statusCode,
      headers: {
        Location: message,
      }
    };
  } else {
    resp = {
      'statusCode': statusCode,
      'body': JSON.stringify(message)
    };
  }
  
  console.log(JSON.stringify(resp));
  return resp;
}

function isValidFields(obj, requiredFields) {
  
  var valid = true;
  
  requiredFields.forEach(element => {
    if (obj[element] === undefined) {
      valid = false;
    }
  });
  
  return valid;
}

function randomString(length, chars) {
    var result = '';
    for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

function getRedirectUri(event) {
  
  var validHosts = process.env.REDIRECT_URI.split(",");
  var uri = validHosts[0];

  if (event.queryStringParameters != null && event.queryStringParameters["redirect_uri"] != null) {
    let newRedirect = decodeURIComponent(event.queryStringParameters["redirect_uri"]);

    const found = validHosts.find(element => newRedirect.startsWith(element));
    if (found) {
      uri = newRedirect;
    }
  }

  return uri;
}