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
const cors = require('cors');

const app = express();
app.set('trust proxy', 1);
// ── 1. Safe middleware (NO body parsing yet!) ──
app.use(cors({
  origin: "https://jebessafrontend.vercel.app",
  credentials: true
}));

app.use(helmet({
  contentSecurityPolicy: false,
}));

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── 2. Connect to MongoDB and WAIT (critical fix!) ──
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      family: 4,
    });
    console.log('✅ MongoDB truly connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
};

// We will await this inside an IIFE below
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
  createdAt: { type: Date, default: Date.now, expires: 3600 },
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
  limits: { fileSize: 5 * 1024 * 1024 },
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

// ── Wrap everything in async IIFE so we can await DB ──
(async () => {
  await connectDB();

  // -------------------- ADMINJS SETUP --------------------
AdminJS.registerAdapter({
  Database: AdminJSMongoose.Database,
  Resource: AdminJSMongoose.Resource,
});

const componentLoader = new AdminJS.ComponentLoader();

// Create component references (these are what you use in resources)
const ImageUpload = componentLoader.add('ImageUpload', './components/ImageUpload');
const ImageShow   = componentLoader.add('ImageShow',   './components/ImageShow');

const admin = new AdminJS({
  componentLoader,

  resources: [
    {
      resource: Project,
      options: {
        properties: {
          image: {
            type: 'string',
            components: {
              edit: ImageUpload,
              show: ImageShow,
              // list: ImageShow,    // optional - show small preview in list view
            },
          },
        },
      },
    },
    {
      resource: Service,
      options: {
        properties: {
          image: {
            type: 'string',
            components: {
              edit: ImageUpload,
              show: ImageShow,
              // list: ImageShow,
            },
          },
        },
      },
    },
    {
      resource: Inquiry,
      options: {
        actions: {
          new: false,
          edit: false,
        },
      },
    },
    {
      resource: Config,
      options: {
        // Remove isDisabled if you want to edit these fields
        // If leadership/management are actual fields in Config schema, keep only if you truly want read-only
        // properties: {
        //   leadership: { isDisabled: true },
        //   management: { isDisabled: true },
        // },
        // Optional: better labels and visibility
        properties: {
          about_intro:      { type: 'textarea' },
          vision_text:      { type: 'textarea' },
          mission_text:     { type: 'textarea' },
          footer_text:      { type: 'textarea' },
          contact_address:  { type: 'textarea' },
        },
      },
    },
    {
      resource: User,
      options: {
        properties: {
          password: {
            type: 'password',
            isVisible: { edit: true, show: false, list: false },
          },
        },
        actions: {
          new: {
            before: async (req) => {
              if (req.payload.password) {
                req.payload.password = await bcrypt.hash(req.payload.password, 12);
              }
              return req;
            },
          },
          edit: {
            before: async (req) => {
              if (req.payload.password) {
                req.payload.password = await bcrypt.hash(req.payload.password, 12);
              }
              return req;
            },
          },
        },
      },
    },
  ],

  dashboard: {
    handler: async () => {
      try {
        const [inquiriesCount, projectsCount, servicesCount, recentInquiriesRaw] = await Promise.all([
          Inquiry.countDocuments(),
          Project.countDocuments(),
          Service.countDocuments(),
          Inquiry.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('name email createdAt _id')
            .lean(),
        ]);

        return {
          stats: {
            inquiries: inquiriesCount,
            projects: projectsCount,
            services: servicesCount,
          },
          recentInquiries: recentInquiriesRaw || [],
        };
      } catch (err) {
        console.error('Dashboard handler error:', err);
        return {
          stats: { inquiries: 0, projects: 0, services: 0 },
          recentInquiries: [],
        };
      }
    },
    // Do NOT add component: ... unless you have a custom Dashboard.jsx file
    // If you do have one, add: component: componentLoader.add('Dashboard', './components/Dashboard')
  },

  rootPath: '/admin',
  branding: {
    companyName: 'JHS Engineering Admin',
    // Optional: logo, theme, etc.
  },
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

  // Mount AdminJS AFTER DB connection, BEFORE body parsers
  app.use(admin.options.rootPath, adminRouter);

  // ── 3. NOW add body parsers + other middleware that need body ──
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiter for contact & auth routes
  const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many requests, please try again later.' }
  });

  // -------------------- API ROUTES --------------------
  // (your existing routes here - they now work after body parsers)
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

  app.post('/api/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ filename: req.file.filename });
  });

  // Forgot Password + Reset Password routes (your code here)
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

  // -------------------- SERVE FRONTEND / ROOT --------------------
  app.get("/", (req, res) => {
    res.json({
      status: "Backend is running 🚀",
      frontend: "https://jebessafrontend.vercel.app"
    });
  });

  // -------------------- INITIAL SETUP --------------------
  async function initializeApp() {
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

  await initializeApp();  // Safe now - DB is ready

  // -------------------- START SERVER --------------------
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 JHS Engineering Backend running on http://localhost:${PORT}`);
    console.log(`🌐 Website: http://localhost:${PORT}`);
    console.log(`🔧 Admin Panel: http://localhost:${PORT}/admin`);
    console.log(`📧 Admin Login: ${process.env.ADMIN_EMAIL || 'Set ADMIN_EMAIL in .env'}`);
  });
})();
