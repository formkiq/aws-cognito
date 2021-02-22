const AWS = require('aws-sdk');
//const AmazonCognitoIdentity = require('amazon-cognito-identity-js');
//var CognitoUser = AmazonCognitoIdentity.CognitoUser;
//var CognitoUserPool = AmazonCognitoIdentity.CognitoUserPool;

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
    
    if (path != null && event.body != null) {
      
      let obj = JSON.parse(event.body);
      
      if (path == "/register") {
        return handleRegister(obj);
      } else if (path == "/login") {
        return login(obj);
      } else if (path == "/changepassword") {
        return changepassword(obj);
      } else if (path == "/lostpassword") {
        return lostpassword(obj);
      } else if (path == "/confirmLostPassword") {
        return confirmLostPassword(obj);
      } else {
        return response(400, {message: "invalid request"});
      }

    } else if (path != null && path == "/confirmSignUp") {
      return confirmSignUp(event);
    } else if (path != null && path == "/confirmRegistration") {
      return confirmRegistration(event);
    } else {
      return response(400, {message:"invalid body"});
    }
};

function confirmRegistration(event) {
  
  let code = event.queryStringParameters.code;
  let username = event.queryStringParameters.username;
  let userStatus = event.queryStringParameters.userStatus;
  
  return login({username: username, password: code}).then((data) => {
    var body = JSON.parse(data.body);
    if (body.ChallengeName == "NEW_PASSWORD_REQUIRED") {
      userStatus = "NEW_PASSWORD_REQUIRED";
    }
    
    return response(301, process.env.REDIRECT_URI + "?success=true&userStatus=" + userStatus + "&code=" + encodeURIComponent(code));
  }).catch((error) => {
    console.log("ERROR: " + JSON.stringify(error));
    return response(301, process.env.REDIRECT_URI + "?success=false&userStatus=" + userStatus + "&code=" + encodeURIComponent(code));
  });
}

function confirmSignUp(event) {
  
  let clientId = event.queryStringParameters.clientId;
  let code = event.queryStringParameters.code;
  let username = event.queryStringParameters.username;
  let userStatus = event.queryStringParameters.userStatus;
  
  let params = {
    ClientId: clientId,
    ConfirmationCode: code,
    Username: username
  };
  
  return COGNITO_CLIENT.confirmSignUp(params).promise().then((data) => {
    return response(301, process.env.REDIRECT_URI + "?success=true&userStatus=" + userStatus);
  }).catch((error) => {
    console.log("ERROR: " + error);
    return response(301, process.env.REDIRECT_URI + "?success=false&userStatus=" + userStatus);
  });
}

function confirmLostPassword(obj) {
    
  let params = {
    ClientId: obj.clientId,
    ConfirmationCode: obj.code,
    Username: obj.username,
    Password: obj.password
  };
  
  return COGNITO_CLIENT.confirmForgotPassword(params).promise().then((data) => {
    return response(301, process.env.REDIRECT_URI + "?success=true");
  }).catch((error) => {
    console.log("ERROR: " + error);
    return response(301, process.env.REDIRECT_URI + "?success=false");
  });
}

function handleRegister(obj) {
  let requiredFields = ["username", "password"];

  if (isValidFields(obj, requiredFields)) {

    var params = {
      ClientId: process.env.POOL_CLIENT_ID,
      Password: obj.password,
      Username: obj.username
    };

    return COGNITO_CLIENT.signUp(params).promise().then((data) => {
      console.log("DATA: " + data);
      return response(200, {message:"User registered"});
    }).catch((error) => {
      console.log("ERROR: " + error);
      return response(400, error);
    });

  } else {
    return response(400, {message: "missing fields 'username', 'password'"});
  }
}

function changepassword(obj) {
  let requiredFields = ["accesstoken", "password", "previouspassword"];

  if (isValidFields(obj, requiredFields)) {

    var params = {
      PreviousPassword: obj.previouspassword,
      ProposedPassword: obj.password,
      AccessToken: obj.accesstoken
    };

    return COGNITO_CLIENT.changePassword(params).promise().then((data) => {
      return response(200, {message:"Change Password"});
    }).catch((error) => {
      return response(400, error);
    });

  } else {
    return response(400, {message: "missing fields 'username','password','previouspassword'"});
  }
}

function lostpassword(obj) {
  let requiredFields = ["username"];

  if (isValidFields(obj, requiredFields)) {

    var params = {
      ClientId: process.env.POOL_CLIENT_ID,
      Username: obj.username
    };

    return COGNITO_CLIENT.forgotPassword(params).promise().then((data) => {
      return response(200, {message:"Password reset sent"});
    }).catch((error) => {
      return response(400, error);
    });

  } else {
    return response(400, {message: "missing fields 'username'"});
  }
}

function login(obj) {
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

  } else {
    return response(400, {message: "missing fields 'username'"});
  }
}

function response(statusCode, message) {

  if (statusCode == 301) {
    return {
      'statusCode': statusCode,
      headers: {
        Location: message,
      }
    };
  } else {
    return {
      'statusCode': statusCode,
      'body': JSON.stringify(message)
    };
  }
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
