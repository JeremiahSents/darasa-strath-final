const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {body, validationResult} = require('express-validator');
const supabase = require('../database/db');

const router = express.Router();
// Middleware to validate user input

// Register a new user
const ValidateRegister = [
    body('full_name').notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Please enter a valid email address'),
    body('password')
        .isLength({min: 6})
        .withMessage('Password must be at least 6 characters long'),
    body('role').isIn(['student','lecturer']).withMessage('Role is required')
];

// Middleware to validate login input
const ValidateLogin = [
    body('email').isEmail().withMessage('Please enter a valid email address'),
    body('password')
        .isLength({min: 6})
        .withMessage('Password must be at least 6 characters long')
];

// Register route
router.post('/register', ValidateRegister, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message : 'Validation failed',
                errors: errors.array()
            });
        }
        const {full_name, email, password, role} = req.body;

        // Check if user already exists
        const {data: existingUser, error: userError} = await supabase
            .from('users')
            .select('email')
            .eq('email', email)
            .single();

            if(existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'User already exists'
                });
            }

        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert new user into the database
        const {data: newUser, error: insertError} = await supabase
            .from('users')
            .insert([{
                full_name,
                 email, 
                 password: hashedPassword, 
                 role
                }
            ])
            .select('id, full_name, email, role,created_at')
            .single();

            // Check for errors during insertion
        if (insertError) {
            console.error('Error inserting user:', insertError);
            return res.status(500).json({
                success: false,
                message: 'Error creating user',
                error: insertError.message
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: newUser.id, 
                email: newUser.email, 
                role: newUser.role
             },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user:newUser,
                token
            }
            });
        } catch (error) {
            console.error('Error in registration:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    });
    
    // Login route
    router.post('/login', ValidateLogin, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        const {email, password} = req.body;

        // Check if user exists
        const {data: user, error: userError} = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (userError || !user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

           // Remove password from user object
    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
// Profile route
    router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email, role, created_at, updated_at')
      .eq('id', req.user.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
}

module.exports = router;