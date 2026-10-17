// Makes every model return `id` (string) instead of `_id`, and hides secrets.
module.exports = (schema) =>
  schema.set('toJSON', {
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      delete ret.passwordHash;
      delete ret.passwordChangedAt;
      return ret;
    },
  });
