const response = await axios.get(`${this.FINHUB_BASE_URL}/coins/${coinId}`, {
  params: { ... },
  headers: {
    'x-cg-demo-api-key': process.env.FINHUB_API_KEY  // ← reads from Render env
  }
});
