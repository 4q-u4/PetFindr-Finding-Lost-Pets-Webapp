//! === Module Imports === //
import dotenv from "dotenv"; //EXP: Load environment variables from .env file
dotenv.config();
import express from "express"; //EXP: Import Express web framework
import fetch from "node-fetch"; //EXP: Import node-fetch for making HTTP requests
import path from "path"; //EXP: Import path module for handling file paths
import mysql from "mysql2"; //EXP: Import MySQL module for database interaction
import { fileURLToPath } from "url"; //EXP: Import utility function for working with file URLs

//! === Create an instance of the Express application === //
const app = express();

//! === Middleware === //
app.use(express.json()); //EXP: Middleware to parse JSON in request bodies

//! === Port Configuration === //
const port = process.env.PORT || 4000;

//! === Start Server === //
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
}); //EXP: Start the server and listen for requests on the defined port

//! === Directory Configuration === //
const __dirname = path.dirname(fileURLToPath(import.meta.url));

//! === Middleware Configuration === //
app.use(express.urlencoded({ extended: true })); //EXP: Middleware to parse URL-encoded data in request bodies
app.use(express.static("public")); //EXP: Middleware to serve static files from the "public" directory

//! === MySQL Connection Pool Configuration === //
const pool = mysql.createPool({ //EXP: Create a pool of connections to MySQL database
  // pool of connections that can be reused //promise will allow to use promise api version of mysql instead of call back version
  host: process.env.HOST,
  user: process.env.DBUSER,
  password: process.env.DBPASS,
  database: process.env.DB
}).promise();

//! === Establish Connection and Handle Result === //
pool.getConnection() //EXP: Acquire a connection from the pool
  .then(connection => {
    console.log('MySQL Database Connected Successfully!');
    connection.release(); //EXP: Release the connection back to pool for reuse
  })
  .catch(error => {
    console.error('Error connecting to MySQL Database:', error.message);
  });

//! TEST 001 Insert Data 

// async function insertData() {
//   try {
//     const [result] = await pool.query(
//       "INSERT INTO user_table (fname, lname, email, password, phone) VALUES (?, ?, ?, ?, ?)",
//       ['John', 'Doe', 'john@example.com', 'hashed_password', '1234567890']
//     );
//     console.log('Data inserted successfully:', result);
//   } catch (error) {
//     console.error('Error inserting data:', error);
//   }
// }
// insertData();
// TEST Select Data
// const [result] = await pool.query("SELECT * FROM user_table") //cause imusing modules i used await on top level await (await is out of async) // [result] to return only 1 array
// console.log(result);


//! === Captcha Verification === //
async function verify_captcha(token) { //EXP: Verify the user's captcha token
  const params = new URLSearchParams({
    secret: captchaSecretKey,
    response: token,
  });
  try {
    const response = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",     //EXP: Send a POST request to hCaptcha's verification endpoint
      body: params,
    });
    const data = await response.json();
    return [data, null];     //EXP: Parse and return the response data
  } catch (error) {
    console.error(error);
    return [null, error.message];
  }
}

//! === sign-up.html === CAPTCHA Verification and Form Submission Route === //
const captchaSecretKey = process.env.hCaptchaSecret; //EXP: Initialize hCaptcha with your hCaptcha secret key

app.post('/verify-captcha', async (req, res) => { //EXP: POST route for verifying captcha and handling form submission
  console.log('Received data:', req.body);

  //EXP: Extract form data and captcha response from request body 
  const { 'signup-fname': fname, 'signup-lname': lname, 'sign-up-phone': phone, 'signup-email': email, 'signup-password': password, 'h-captcha-response': captchaResponse } = req.body;

  try {
    //EXP: Verify CAPTCHA response using your async function
    const [captchaData, captchaError] = await verify_captcha(captchaResponse);

    if (captchaError) {     //EXP: Handle CAPTCHA verification error
      return res.status(500).json({ error: 'CAPTCHA verification error' });
    }

    if (!captchaData.success) {
      return res.status(400).json({ error: 'CAPTCHA verification failed' });
    }

    //EXP: Check if email already exists in the database
    const emailExistsQuery = 'SELECT COUNT(*) AS count FROM user_table WHERE email = ?';
    const [emailExistsResult] = await pool.query(emailExistsQuery, [email]);

    if (emailExistsResult[0].count > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    //EXP: CAPTCHA verification successful, proceed with form submission
    const sql = "INSERT INTO user_table (fname, lname, email, password, phone) VALUES (?, ?, ?, ?, ?)";
    try {
      //EXP: Check for undefined values and replace with null if necessary
      const values = [fname, lname, email, password, phone || null];

      //EXP: Perform database insertion logic here
      const [result] = await pool.query(sql, values);
      console.log('Data inserted successfully');

      //EXP: Send a success JSON response
      res.status(200).json({ message: 'Signup successful' });

    } catch (error) {
      console.error('Error inserting data:', error);
      res.status(500).json({ error: 'Error signing up' });
    }
  } catch (error) {
    console.error('CAPTCHA verification error:', error);
    res.status(500).json({ error: 'CAPTCHA verification error' });
  }
});

//! === LOGIN === //
app.post('/login', async (req, res) => { //EXP: POST route for handling user login
  const { 'login-email': email, 'login-password': password } = req.body;

  //EXP: Check email and password against the database
  const loginQuery = 'SELECT id FROM user_table WHERE email = ? AND password = ?';
  const [loginResult] = await pool.query(loginQuery, [email, password]);

  //EXP: Check if login was successful
  if (loginResult.length > 0) {
    const userId = loginResult[0].id; // Get user ID from the query result

    // Successful login
    res.status(200).json({ message: 'Login successful', userId: userId }); // Include userId in the response
  } else {
    // Failed login
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

//! === Fetch User Info by User ID === //
app.get('/user-info', async (req, res) => {
  const userId = req.query.id;
  console.log('Received User ID:', userId);

  if (!userId) {   //EXP: Check if user ID is provided
    return res.status(400).json({ error: 'User ID not provided' });
  }

  try {
    //EXP: Execute a SELECT query to retrieve user info based on user ID
    const [rows] = await pool.query('SELECT * FROM user_table WHERE id = ?', [userId]);

    if (rows.length > 0) {     //EXP: Check if user info is found based on the query result
      const userInfo = rows[0];
      res.status(200).json(userInfo); //EXP: Send user info as JSON
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//! === Update User Profile === //
app.put('/update-profile', async (req, res) => {
  const userId = req.body.id;
  const firstName = req.body.fname;
  const lastName = req.body.lname;
  const phone = req.body.phone;
  const email = req.body.email;

  try {
    let query = 'UPDATE user_table SET';     //EXP: Construct the SQL query dynamically based on the provided data
    const values = [];
    if (firstName !== '') {
      query += ' fname=?,';
      values.push(firstName);
    }
    if (lastName !== '') {
      query += ' lname=?,';
      values.push(lastName);
    }
    if (phone !== '') {
      query += ' phone=?,';
      values.push(phone);
    }
    if (email !== '') {
      query += ' email=?,';
      values.push(email);
    }
    // Remove the trailing comma and add the WHERE clause
    query = query.slice(0, -1) + ' WHERE id=?';
    values.push(userId);

    //EXP: Execute the dynamic UPDATE query
    const [result] = await pool.query(query, values);

    if (result.affectedRows > 0) {     //EXP: Check if the profile update was successful
      res.status(200).json({ message: 'Profile updated successfully' });
    } else {
      res.status(500).json({ error: 'Profile update failed' });
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//! === Delete User Account === //
app.delete('/delete-account', async (req, res) => { //EXP: Delete user account based on provided user ID
  const userId = req.query.id;

  if (!userId) {   //EXP: Check if user ID is provided
    return res.status(400).json({ error: 'User ID not provided' });
  }

  try {
    // Delete the user's account from the database based on the provided user ID
    const deleteQuery = 'DELETE FROM user_table WHERE id = ?';
    const [result] = await pool.query(deleteQuery, [userId]);

    if (result.affectedRows > 0) {
      // Account deletion successful
      res.status(200).json({ message: 'Account deleted successfully' });
    } else {
      // No rows were affected, likely due to non-existent user ID
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//! === Change User Password === //
app.post('/change-password', async (req, res) => { //EXP: Change user password based on provided user ID, old password, and new password
  const { userId, oldPassword, newPassword } = req.body;

  try {
    // Check if the provided old password matches the stored password for the user
    const checkPasswordQuery = 'SELECT COUNT(*) AS count FROM user_table WHERE id = ? AND password = ?';
    const [passwordCheckResult] = await pool.query(checkPasswordQuery, [userId, oldPassword]);

    if (passwordCheckResult[0].count === 0) {
      return res.status(401).json({ error: 'Invalid old password' });
    }

    // Update the user's password with the new one
    const updatePasswordQuery = 'UPDATE user_table SET password = ? WHERE id = ?';
    await pool.query(updatePasswordQuery, [newPassword, userId]);

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//! === Send User Location Data long lat (user.html)========================================================================
app.post('/save-location', async (req, res) => {
  try {
    const { userId, latitude, longitude } = req.body;

    // Insert the location data into the user's row in the database
    const insertQuery = 'UPDATE user_table SET lat = ?, lon = ? WHERE id = ?';
    await pool.execute(insertQuery, [latitude, longitude, userId]);

    res.status(200).json({ message: 'Location data saved successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to save location data' });
  }
});

//! === Contact Us === //

app.post("/submit-form", async (req, res) => {
  try {
    const { fname, lname, email, message } = req.body;

    // Insert the form data into the "contact_us" table
    const insertQuery = 'INSERT INTO contact_us (first_name, last_name, email, message) VALUES (?, ?, ?, ?)';
    const [results, fields] = await pool.execute(insertQuery, [fname, lname, email, message]);

    res.status(200).json({ message: 'Form data submitted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to submit form data' });
  }
});

//! === Handle 404 Not Found === //

app.use((req, res) => { //EXP: Handle requests that do not match any defined routes with a 404 error page
  return res.status(404).sendFile(path.join(__dirname, "public", "404.html")); // at the end cause it works from top to buttom
});

//?search bar functionality
