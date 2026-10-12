// middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'atom-flow-dev-secret-change-me';

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: 'مفيش توكن، سجلي دخول الأول' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'التوكن غير صالح أو منتهي' });
    }
    req.user = decoded;
    next();
  });
}

// لازم يتحط بعد authMiddleware مباشرة - بيقفل أي راوت غير اليوزرز اللي role
// بتاعهم 'admin' جوه التوكن (لوحة التحكم بتاعة الأدمن routes/admin.js)
function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'صلاحيات أدمن مطلوبة (Admin access only)' });
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware, JWT_SECRET };
