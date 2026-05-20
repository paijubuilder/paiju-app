const { getDefaultConfig } = require('expo/metro-config');
const { withDevkit } = require('miaoda-expo-devkit/metro');

module.exports = withDevkit(getDefaultConfig(__dirname));
