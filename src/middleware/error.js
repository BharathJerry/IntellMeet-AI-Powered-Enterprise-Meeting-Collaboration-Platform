export const notFound = (req, res) =>
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });

export const errorHandler = (err, _req, res, _next) => {
  const status = err.code === 11000 ? 409 : err.status || 500;
  const message =
    err.code === 11000 ? "Duplicate value" : status === 500 ? "Internal server error" : err.message;
  if (status === 500) console.error(err);
  res.status(status).json({ success: false, message });
};
