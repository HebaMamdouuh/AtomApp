// routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();

const store = require('../data/store');
const { users } = require('../data/mockData');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth');
const User = require('../models/User');

const MAX_DEVICES = store.MAX_DEVICES_PER_USER;

// رسالة موحدة لما اليوزر يوصل لحد الـ 3 أجهزة ويحاول يسجل دخول من جهاز رابع
function deviceLimitResponse(res) {
  return res.status(403).json({
    message: `تم الوصول للحد الأقصى (${MAX_DEVICES} أجهزة) لهذا الحساب. اطلبي من الأدمن إنهاء جلسة جهاز قديم، أو سجّلي خروج من جهاز تاني الأول.`,
    code: 'DEVICE_LIMIT_REACHED',
  });
}

// POST /api/auth/login
// body: { username, password, deviceId, deviceName?, platform? }
// الـ deviceId لازم يبقى معرف ثابت وفريد للجهاز (بيتولد مرة واحدة في التطبيق
// ويتخزن محليًا) عشان نقدر نفرّق بين 3 أجهزة مختلفة لنفس اليوزر ونمنع الرابع
router.post('/login', async (req, res) => {
  try {
      const { username, password, deviceId, deviceName, platform } = req.body;

      if (!username || !password) {
          return res.status(400).json({ message: 'Username and password are required.' });
      }
      if (!deviceId) {
          return res.status(400).json({ message: 'deviceId is required.' });
      }

      // 1. Check fallback/mock users first (This keeps your 'admin' user working)
      const mockUser = users.find(
          (u) => u.username === username && u.password === password
      );

      if (mockUser) {
          const { error } = store.registerOrTouchSession(mockUser.id, {
              deviceId,
              deviceName,
              platform,
          });
          if (error === 'LIMIT_REACHED') {
              return deviceLimitResponse(res);
          }

          const token = jwt.sign(
              {
                  id: mockUser.id,
                  username: mockUser.username,
                  name: mockUser.name,
                  role: mockUser.role || 'user',
              },
              JWT_SECRET,
              { expiresIn: '7d' }
          );
          return res.json({
              token,
              user: {
                  id: mockUser.id,
                  username: mockUser.username,
                  name: mockUser.name,
                  role: mockUser.role || 'user',
                  isSubscribed: mockUser.isSubscribed !== false,
              },
          });
      }

      // 2. Check MongoDB for registered users
      const dbUser = await User.findOne({ username });
      if (!dbUser) {
          return res.status(401).json({ message: 'Invalid username or password.' });
      }

      // Compare the provided password with the hashed password in DB
      const isMatch = await bcrypt.compare(password, dbUser.password);
      if (!isMatch) {
          return res.status(401).json({ message: 'Invalid username or password.' });
      }

      // فحص حد الـ 3 أجهزة لليوزرز المسجلين بالـ MongoDB (sessions مخزنة جوه الدوكيومنت نفسه)
      const existingSession = dbUser.sessions.find((s) => s.deviceId === deviceId);
      if (existingSession) {
          existingSession.lastActiveAt = new Date();
          if (deviceName) existingSession.deviceName = deviceName;
          if (platform) existingSession.platform = platform;
      } else {
          if (dbUser.sessions.length >= MAX_DEVICES) {
              return deviceLimitResponse(res);
          }
          dbUser.sessions.push({
              sessionId: crypto.randomBytes(8).toString('hex'),
              deviceId,
              deviceName: deviceName || 'Unknown device',
              platform: platform || null,
              createdAt: new Date(),
              lastActiveAt: new Date(),
          });
      }
      await dbUser.save();

      // Generate token for DB user
      const token = jwt.sign(
          {
              id: dbUser._id,
              username: dbUser.username,
              name: dbUser.username,
              role: dbUser.role || 'user',
          },
          JWT_SECRET,
          { expiresIn: '7d' }
      );

      return res.json({
          token,
          user: {
              id: dbUser._id,
              username: dbUser.username,
              name: dbUser.username,
              role: dbUser.role || 'user',
              isSubscribed: dbUser.isSubscribed !== false,
          },
      });

  } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error during login.' });
  }
});

// POST /api/auth/logout
// body: { deviceId } -> بتحرر مكان الجهاز ده من الـ 3 أماكن المتاحة (Logout عادي،
// مش لازم تنتظري أدمن). لو مبعتش deviceId التوكن هيفضل صالح لحد ما ينتهي عادي
router.post('/logout', authMiddleware, async (req, res) => {
  try {
      const { deviceId } = req.body;
      if (!deviceId) {
          return res.json({ message: 'Logged out.' });
      }

      const mockUser = users.find((u) => u.id === req.user.id);
      if (mockUser) {
          store.removeSessionByDevice(mockUser.id, deviceId);
          return res.json({ message: 'Logged out.' });
      }

      const dbUser = await User.findById(req.user.id);
      if (dbUser) {
          dbUser.sessions = dbUser.sessions.filter((s) => s.deviceId !== deviceId);
          await dbUser.save();
      }
      res.json({ message: 'Logged out.' });
  } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Internal server error during logout.' });
  }
});

// GET /api/auth/me -> Current user data (for Settings page)
router.get('/me', authMiddleware, async (req, res) => {
  try {
      // 1. Check if the authenticated user is from mockData (admin)
      const mockUser = users.find((u) => u.id === req.user.id);
      if (mockUser) {
          return res.json({
              user: {
                  id: mockUser.id,
                  username: mockUser.username,
                  name: mockUser.name,
                  role: mockUser.role || 'user',
                  isSubscribed: mockUser.isSubscribed !== false,
                  deviceCount: store.getSessionsForUser(mockUser.id).length,
                  maxDevices: MAX_DEVICES,
              },
          });
      }

      // 2. Check if the authenticated user is from MongoDB
      const dbUser = await User.findById(req.user.id);

      if (!dbUser) {
          return res.status(404).json({ message: 'User not found.' });
      }

      res.json({
          user: {
              id: dbUser._id,
              username: dbUser.username,
              name: dbUser.username,
              role: dbUser.role || 'user',
              isSubscribed: dbUser.isSubscribed !== false,
              deviceCount: dbUser.sessions.length,
              maxDevices: MAX_DEVICES,
          },
      });
  } catch (error) {
      console.error('Fetch user error:', error);
      res.status(500).json({ message: 'Internal server error fetching user data.' });
  }
});

module.exports = router;
