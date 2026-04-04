const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// .sql ファイルを文字列としてインポートできるようにする (Drizzle migrations)
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'sql');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'sql'];

module.exports = config;
