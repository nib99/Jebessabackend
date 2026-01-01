import React, { useState } from 'react';
import { Box, Label, Input, Button, H5 } from '@adminjs/design-system';

const ImageUpload = (props) => {
  const { property, record, onChange } = props;
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.filename) {
        onChange(property.name, data.filename);
      }
    } catch (err) {
      alert('Upload failed');
    }
    setUploading(false);
  };

  const imageUrl = record.params[property.name]
    ? `/uploads/${record.params[property.name]}`
    : null;

  return (
    <Box>
      <Label>{property.label}</Label>
      {imageUrl && (
        <Box my="lg">
          <img src={imageUrl} alt="Current" style={{ maxWidth: '300px', borderRadius: '8px' }} />
        </Box>
      )}
      <Input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} />
      {uploading && <H5 mt="sm">Uploading...</H5>}
    </Box>
  );
};

export default ImageUpload;
