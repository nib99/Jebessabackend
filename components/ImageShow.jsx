import React from 'react';
import { Box, Label } from '@adminjs/design-system';

const ImageShow = (props) => {
  const { record, property } = props;
  const imageUrl = record.params[property.name]
    ? `/uploads/${record.params[property.name]}`
    : null;

  return (
    <Box>
      <Label>{property.label}</Label>
      {imageUrl ? (
        <Box mt="lg">
          <img src={imageUrl} alt="Preview" style={{ maxWidth: '400px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
        </Box>
      ) : (
        <Box mt="sm" color="grey60">No image uploaded</Box>
      )}
    </Box>
  );
};

export default ImageShow;
