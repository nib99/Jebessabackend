require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const nodemailer = require('nodemailer');
const cryptoRandomString = require('crypto-random-string');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const AdminJS = require('adminjs');
const AdminJSExpress = require('@adminjs/express');
const AdminJSMongoose = require('@adminjs/mongoose');

const app = express();

const cors = require("cors");

app.use(cors({
  origin: "https://jebessafrontend.vercel.app",
  credentials: true
}));
// -------------------- SECURITY & MIDDLEWARE --------------------
app.use(helmet({
  contentSecurityPolicy: false, // Disable if you have inline scripts/styles
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiter for contact & auth routes
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many requests, please try again later.' }
});

// -------------------- DATABASE CONNECTION --------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
// -------------------- MODELS --------------------
const serviceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  image: String,
}, { timestamps: true });
const Service = mongoose.model('Service', serviceSchema);

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  location: String,
  year: Number,
  type: { type: String, enum: ['Commercial', 'Residential', 'Infrastructure', 'Industrial'] },
  description: { type: String, required: true },
  image: String,
  badge: String,
}, { timestamps: true });
const Project = mongoose.model('Project', projectSchema);

const inquirySchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  projectType: String,
  message: { type: String, required: true },
}, { timestamps: true });
const Inquiry = mongoose.model('Inquiry', inquirySchema);

const configSchema = new mongoose.Schema({
  company_name: String,
  hero_tagline: String,
  hero_subtitle: String,
  hero_button: String,
  about_intro: String,
  vision_text: String,
  mission_text: String,
  contact_address: String,
  contact_phone: String,
  contact_email: String,
  footer_text: String,
}, { minimize: false, timestamps: true });
const Config = mongoose.model('Config', configSchema);

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'editor'], default: 'editor' },
  name: String,
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

const resetTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 }, // 1 hour expiry
});
const ResetToken = mongoose.model('ResetToken', resetTokenSchema);

// -------------------- IMAGE UPLOAD CONFIG --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads');
    require('fs').mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are allowed'), false);
  }
});

// -------------------- EMAIL TRANSPORTER --------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false }
});

transporter.verify((error) => {
  if (error) console.error('❌ SMTP Error:', error);
  else console.log('✅ SMTP Ready');
});

// -------------------- ADMINJS SETUP --------------------
AdminJS.registerAdapter({
  Database: AdminJSMongoose.Database,
  Resource: AdminJSMongoose.Resource,
});

const admin = new AdminJS({
  resources: [
    Service, Project,
    { resource: Inquiry, options: { actions: { new: false, edit: false } } },
    Config,
    {
      resource: User,
      options: {
        properties: { password: { type: 'password', isVisible: { edit: true, show: false, list: false } } },
        actions: {
          new: { before: async (req) => req.payload.password ? { ...req.payload, password: await bcrypt.hash(req.payload.password, 12) } : req },
          edit: { before: async (req) => req.payload.password ? { ...req.payload, password: await bcrypt.hash(req.payload.password, 12) } : req }
        }
      }
    }
  ],
  dashboard: {
    handler: async () => {
      const [inquiries, projects, services] = await Promise.all([
        Inquiry.countDocuments(),
        Project.countDocuments(),
        Service.countDocuments()
      ]);
      return { stats: { inquiries, projects, services } };
    },
    //component: AdminJS.bundle('./components/dashboard.jsx')
  },
  rootPath: '/admin',
  branding: { companyName: 'JHS Engineering Admin' }
});

const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
  admin,
  {
    authenticate: async (email, password) => {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user && await bcrypt.compare(password, user.password)) return user;
      return null;
    },
    cookieName: 'jhs_admin',
    cookiePassword: process.env.SESSION_SECRET
  },
  null,
  {
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
  }
);

app.use(admin.options.rootPath, adminRouter);

// -------------------- API ROUTES --------------------
app.get('/api/services', async (_, res) => {
  try {
    res.json(await Service.find().sort({ createdAt: -1 }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/projects', async (_, res) => {
  try {
    res.json(await Project.find().sort({ year: -1 }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/config', async (_, res) => {
  try {
    res.json(await Config.findOne() || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const inquiry = await Inquiry.create(req.body);

    await transporter.sendMail({
      from: `"JHS Website" <${process.env.SMTP_USER}>`,
      to: process.env.NOTIFY_EMAIL || process.env.SMTP_USER,
      replyTo: req.body.email,
      subject: `New Inquiry from ${req.body.name}`,
      html: `
        <h2>New Project Inquiry</h2>
        <ul>
          <li><strong>Name:</strong> ${req.body.name}</li>
          <li><strong>Email:</strong> ${req.body.email}</li>
          <li><strong>Phone:</strong> ${req.body.phone || 'N/A'}</li>
          <li><strong>Project Type:</strong> ${req.body.projectType || 'N/A'}</li>
          <li><strong>Message:</strong><br>${req.body.message.replace(/\n/g, '<br>')}</li>
        </ul>
      `
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Image Upload for AdminJS
app.post('/api/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ filename: req.file.filename });
});

// Forgot Password
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ success: true, message: 'If email exists, reset link sent' });

    const token = cryptoRandomString({ length: 48, type: 'url-safe' });
    await ResetToken.create({ userId: user._id, token });

    const resetLink = `\( {process.env.CLIENT_URL || 'http://localhost:5000'}/reset-password.html?token= \){token}`;

    await transporter.sendMail({
      from: `"JHS Engineering" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Password Reset - JHS Admin',
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password (expires in 1 hour).</p>`
    });

    res.json({ success: true, message: 'If email exists, reset link sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed' });
  }
});

// Reset Password
app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 8)
    return res.status(400).json({ error: 'Invalid request' });

  try {
    const record = await ResetToken.findOne({ token });
    if (!record) return res.status(400).json({ error: 'Invalid or expired token' });

    const user = await User.findById(record.userId);
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    await ResetToken.deleteOne({ _id: record._id });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// -------------------- SERVE FRONTEND --------------------
app.get("/", (req, res) => {
  res.json({
    status: "Backend is running 🚀",
    frontend: "https://jebessafrontend.vercel.app"
  });
});

// -------------------- INITIAL SETUP --------------------
async function initializeApp() {
  // Create default admin
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const exists = await User.findOne({ email: process.env.ADMIN_EMAIL.toLowerCase() });
    if (!exists) {
      const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
      await User.create({
        email: process.env.ADMIN_EMAIL.toLowerCase(),
        password: hashed,
        role: 'admin',
        name: 'Administrator'
      });
      console.log('✅ Default admin user created');
    }
  }

  // Create default config if none exists
  const configExists = await Config.findOne();
  if (!configExists) {
    await Config.create({
      company_name: "JHS Engineering and Trade",
      hero_tagline: "Building Ethiopia's Future, One Project at a Time",
      hero_subtitle: "Premier construction company delivering excellence in commercial, residential, and infrastructure projects across Ethiopia with over 15 years of trusted expertise.",
      hero_button: "Get Started",
      about_intro: "Leading construction and engineering company owned by Jebessa Shegu Jetu, delivering excellence across Ethiopia.",
      vision_text: "To be the leading construction company in Ethiopia, recognized for transforming the nation's landscape through innovative, sustainable, and world-class infrastructure projects.",
      mission_text: "To deliver exceptional construction projects that exceed client expectations through skilled craftsmanship, cutting-edge technology, and uncompromising safety standards.",
      contact_address: "Akaki Kality Sub-City<br>Addis Ababa, Ethiopia 🇪🇹",
      contact_phone: "+251 94 972 7279",
      contact_email: "info@jhsengineering.com",
      footer_text: "© 2026 JHS Engineering and Trade. All rights reserved. | Owned by Jebessa Shegu Jetu | Building Ethiopia's Future 🇪🇹"
    });
    console.log('✅ Default config created');
  }
}

initializeApp().catch(console.error);

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 JHS Engineering Backend running on http://localhost:${PORT}`);
  console.log(`🌐 Website: http://localhost:${PORT}`);
  console.log(`🔧 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`📧 Admin Login: ${process.env.ADMIN_EMAIL || 'Set ADMIN_EMAIL in .env'}`);
});
