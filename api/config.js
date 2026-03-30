module.exports = (req, res) => {
  const defaultApiKey = process.env.DEFAULT_API_KEY || '';

  if (!defaultApiKey) {
    return res.status(500).json({ error: 'DEFAULT_API_KEY environment variable is missing.' });
  }

  return res.status(200).json({ defaultApiKey });
};
