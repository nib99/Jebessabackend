// componentsLoader.js
const { ComponentLoader } = require('adminjs');

const componentLoader = new ComponentLoader();

const Components = {
  Dashboard: componentLoader.add('Dashboard', './components/dashboard.jsx'),
};

module.exports = { componentLoader, Components };
