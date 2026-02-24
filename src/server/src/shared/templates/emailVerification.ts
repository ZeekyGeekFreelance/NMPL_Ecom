import { getPlatformName, getSupportEmail } from "@/shared/utils/branding";

const emailVerificationTemplate = (emailVerificationToken: string) => {
  const platformName = getPlatformName();
  const supportEmail = getSupportEmail();
  const formattedCode = emailVerificationToken
    .toString()
    .split("")
    .map((digit) => `<span class="digit-box">${digit}</span>`)
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify Your Email - ${platformName}</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f4f4f4;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 30px auto;
        background: #fff;
        padding: 25px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        text-align: center;
      }
      .header {
        background: linear-gradient(135deg, #1f2937, #111827);
        color: white;
        padding: 20px;
        font-size: 24px;
        font-weight: bold;
        border-radius: 12px 12px 0 0;
      }
      .content {
        padding: 20px;
        font-size: 17px;
        color: #333;
        line-height: 1.6;
      }
      .code-container {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin: 24px 0;
      }
      .digit-box {
        font-size: 22px;
        font-weight: bold;
        border: 2px solid #1f2937;
        color: #1f2937;
        padding: 10px;
        display: inline-block;
        border-radius: 8px;
        width: 48px;
        height: 48px;
        line-height: 48px;
        text-align: center;
        background: white;
      }
      .footer {
        font-size: 13px;
        color: #6b7280;
        margin-top: 20px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">${platformName}</div>
      <div class="content">
        <p>Welcome to <strong>${platformName}</strong>. Use this code to verify your email address.</p>
        <div class="code-container">${formattedCode}</div>
        <p>If you did not request this, you can safely ignore this email.</p>
      </div>
      <div class="footer">
        Need help? Contact <a href="mailto:${supportEmail}">${supportEmail}</a><br />
        &copy; ${new Date().getFullYear()} ${platformName}. All rights reserved.
      </div>
    </div>
  </body>
</html>
`;
};

export default emailVerificationTemplate;
