import React from 'react';
import { H1, H2, Box, Text, Card, Row, Col } from '@adminjs/design-system';

const CustomDashboard = (props) => {
  const { stats, recentInquiries } = props.data;

  return (
    <Box variant="white" p="xl">
      <H1>JHS Engineering & Trade - Admin Dashboard</H1>
      <Text mt="md" opacity="0.8">Welcome back! Here's your site overview.</Text>

      <Row mt="xl" gridGap="lg">
        <Col size={{ sm: 12, md: 4 }}>
          <Card as="a" href="/admin/Inquiries" style={{ textDecoration: 'none' }}>
            <H2>{stats.inquiries}</H2>
            <Text opacity="0.7">Total Inquiries</Text>
          </Card>
        </Col>
        <Col size={{ sm: 12, md: 4 }}>
          <Card as="a" href="/admin/Projects" style={{ textDecoration: 'none' }}>
            <H2>{stats.projects}</H2>
            <Text opacity="0.7">Projects</Text>
          </Card>
        </Col>
        <Col size={{ sm: 12, md: 4 }}>
          <Card as="a" href="/admin/Services" style={{ textDecoration: 'none' }}>
            <H2>{stats.services}</H2>
            <Text opacity="0.7">Services</Text>
          </Card>
        </Col>
      </Row>

      <Box mt="xl">
        <H2>Recent Inquiries</H2>
        {recentInquiries.length > 0 ? (
          <Box as="table" mt="lg" width="100%">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '12px' }}>Email</th>
                <th style={{ textAlign: 'left', padding: '12px' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentInquiries.map((inq) => (
                <tr key={inq._id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px' }}>{inq.name}</td>
                  <td style={{ padding: '12px' }}>{inq.email}</td>
                  <td style={{ padding: '12px' }}>{new Date(inq.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </Box>
        ) : (
          <Text mt="lg">No inquiries yet.</Text>
        )}
      </Box>
    </Box>
  );
};

export default CustomDashboard;
