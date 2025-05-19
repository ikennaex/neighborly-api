const nodemailer = require("nodemailer");
const UserModel = require("../Models/User");

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

async function sendProductAlertEmail(product) {
  const { name: productName, location, vendor, _id } = product;

  const vendorDoc = await UserModel.findById(vendor);
  const vendorName = vendorDoc?.businessName || "A seller";

  const users = await UserModel.find({}, "email name");

  if (users.length === 0) return;

  const subject = `${vendorName} just posted "${productName}" in ${location}`;
  const htmlContent = `
    <p><strong>${vendorName}</strong> listed a new product: <strong>${productName}</strong> in <strong>${location}</strong>.</p>
    <p>Login to your neighborly account to view product</p> <br/>
    <p><a href="https://neighborly.ng/products/${_id}">View Product</a></p>

    <p>- Neighborly</p>
  `;
  const textContent = `${vendorName} posted ${productName} in ${location}`;

  for (const user of users) {
    try {
      await transporter.sendMail({
        from: '"Neighborly" <no-reply@neighborly.ng>',
        to: user.email,
        subject,
        text: textContent,
        html: htmlContent,
      });
      console.log(`Email sent to ${user.email}`);
    } catch (error) {
      console.error(`Failed to send email to ${user.email}`, error);
    }
  }
}

module.exports = { sendProductAlertEmail };