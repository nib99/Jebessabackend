import React from 'react';
import { H1, H2, Box, Text, Card, Row, Col, Icon } from '@adminjs/design-system';
import { Chat, Building, Settings } from '@adminjs/design-system/icons';

const Dashboard = (props) => {
  // Safe defaults
  const data = props.data || {};
  const { stats = { inquiries: 0, projects: 0, services: 0 }, recentInquiries = [] } = data;

  // Card styles
  const cardStyles = [
    { bg: '#f3f0ff', icon: <Icon icon={Chat} size={32} color="#7c3aed" />, label: 'Total Inquiries', value: stats.inquiries, href: '/admin/resources/Inquiry' },
    { bg: '#e0f2fe', icon: <Icon icon={Building} size={32} color="#0284c7" />, label: 'Total Projects', value: stats.projects, href: '/admin/resources/Project' },
    { bg: '#ecfdf5', icon: <Icon icon={Settings} size={32} color="#059669" />, label: 'Total Services', value: stats.services, href: '/admin/resources/Service' },
  ];

  return (
    <Box variant="white" p="xl">
      <H1>JHS Engineering & Trade - Admin Dashboard</H1>
      <Text mt="md" opacity="0.8">
        Welcome back! Here's an overview of your site.
      </Text>

      {/* Stats Cards */}
      <Row mt="xl" gridGap="lg">
        {cardStyles.map((card, idx) => (
          <Col key={idx} size={{ sm: 12, md: 4 }}>
            <Card
              as="a"
              href={card.href}
              style={{
                textDecoration: 'none',
                cursor: 'pointer',
                backgroundColor: card.bg,
                transition: 'all 0.2s ease-in-out',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <H2>{card.value}</H2>
                  <Text opacity="0.7">{card.label}</Text>
                </Box>
                {card.icon}
              </Box>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Recent Inquiries Table */}
      <Box mt="xl">
        <H2>Recent Inquiries</H2>
        {recentInquiries.length > 0 ? (
          <Box as="table" mt="lg" width="100%" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Email</th>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentInquiries.map((inq) => (
                <tr key={inq._id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px 16px' }}>{inq.name || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>{inq.email || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {inq.createdAt
                      ? new Date(inq.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Box>
        ) : (
          <Text mt="lg" opacity="0.7">No recent inquiries yet.</Text>
        )}
      </Box>
    </Box>
  );
};

export default Dashboard;
