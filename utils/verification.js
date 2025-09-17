const nodemailer = require('nodemailer');
const config = require('../config');

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.FROM_EMAIL,
    pass: config.FROM_PASS
  }
});

// Generate 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate verification token
const { v4: uuidv4 } = require('uuid');
const generateVerificationToken = () => {
  return uuidv4();
};

// Enhanced email template for verification
const createVerificationEmail = (email, verificationCode, verificationToken, username) => {
  const verificationUrl = `${config.CLIENT_URL}/verify-email?token=${verificationToken}`;
  
  return {
    from: config.FROM_EMAIL,
    to: email,
    subject: '🔐 Verify Your Email - Web Chat by Ankit',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          }
          .content {
            background: white;
            padding: 30px;
            border-radius: 10px;
            margin-top: 20px;
          }
          .header {
            text-align: center;
            color: white;
            margin-bottom: 0;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 300;
          }
          .welcome {
            color: #333;
            font-size: 18px;
            margin-bottom: 20px;
          }
          .verification-code {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 32px;
            font-weight: bold;
            text-align: center;
            padding: 20px;
            border-radius: 10px;
            letter-spacing: 8px;
            margin: 20px 0;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
          }
          .verification-link {
            text-align: center;
            margin: 30px 0;
          }
          .verify-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 40px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            display: inline-block;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
            transition: transform 0.2s;
          }
          .verify-btn:hover {
            transform: translateY(-2px);
          }
          .divider {
            text-align: center;
            margin: 30px 0;
            position: relative;
          }
          .divider::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 1px;
            background: #ddd;
          }
          .divider span {
            background: white;
            padding: 0 20px;
            color: #666;
            font-weight: bold;
          }
          .instructions {
            background: #f8f9ff;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
            margin: 20px 0;
          }
          .instructions h3 {
            color: #667eea;
            margin-top: 0;
          }
          .footer {
            text-align: center;
            color: #666;
            font-size: 14px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
          }
          .warning {
            background: #fff3cd;
            color: #856404;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #ffeaa7;
            margin: 20px 0;
          }
          @media (max-width: 600px) {
            body {
              padding: 10px;
            }
            .container {
              padding: 20px;
            }
            .verification-code {
              font-size: 28px;
              letter-spacing: 6px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>👋 Welcome to Web Chat!</h1>
            <p>by Ankit</p>
          </div>
          
          <div class="content">
            <p class="welcome">Hi <strong>${username}</strong>,</p>
            <p>Thank you for joining Web Chat! We're excited to have you on board. 🚀</p>
            <p>To complete your registration and start chatting with friends, please verify your email address using one of the methods below:</p>
            
            <div class="instructions">
              <h3>📱 Method 1: Verification Code</h3>
              <p>Enter this 6-digit code in the verification form:</p>
              <div class="verification-code">${verificationCode}</div>
              <p><strong>⏱ This code expires in 10 minutes</strong></p>
            </div>
            
            <div class="divider">
              <span>OR</span>
            </div>
            
            <div class="instructions">
              <h3>🔗 Method 2: Verification Link</h3>
              <p>Click the button below to verify instantly:</p>
              <div class="verification-link">
                <a href="${verificationUrl}" class="verify-btn">✅ Verify Email Address</a>
              </div>
            </div>
            
            <div class="warning">
              <strong>⚠️ Security Note:</strong> If you didn't create an account with us, please ignore this email. Your email address will not be used without verification.
            </div>
            
            <div class="footer">
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #667eea; font-family: monospace;">${verificationUrl}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p>Need help? Contact us at <a href="mailto:${config.FROM_EMAIL}" style="color: #667eea;">${config.FROM_EMAIL}</a></p>
              <p style="color: #999;">Web Chat by Ankit © ${new Date().getFullYear()}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  };
};

// Send verification email
const sendVerificationEmail = async (email, verificationCode, verificationToken, username = 'User') => {
  try {
    console.log('Preparing to send verification email to:', email);
    console.log('Verification code:', verificationCode);
    console.log('Verification token:', verificationToken);
    
    const mailOptions = createVerificationEmail(email, verificationCode, verificationToken, username);
    
    const result = await transporter.sendMail(mailOptions);
    console.log('Verification email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('Error sending verification email:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      response: error.response
    });
    return { 
      success: false, 
      error: error.message,
      details: error 
    };
  }
};

// Send code-only verification (for resend)
const sendVerificationCode = async (email, verificationCode, username = 'User') => {
  try {
    const mailOptions = {
      from: config.FROM_EMAIL,
      to: email,
      subject: '🔄 New Verification Code - Web Chat by Ankit',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; text-align: center; color: white;">
            <h2>🔐 New Verification Code</h2>
            <p>Hi ${username}!</p>
          </div>
          <div style="padding: 20px; background: white; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
            <p>Here's your new verification code:</p>
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 8px; margin: 20px 0;">
              ${verificationCode}
            </div>
            <p style="color: #e74c3c; font-weight: bold;">⏱ This code expires in 10 minutes</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
          </div>
        </div>
      `
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('Verification code email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('Error sending verification code:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  generateVerificationCode,
  generateVerificationToken,
  sendVerificationEmail,
  sendVerificationCode,
  createVerificationEmail
};