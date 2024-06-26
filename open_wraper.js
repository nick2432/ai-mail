const open = async (url) => {
    const openPackage = await import('open');
    openPackage.default(url);
  };
  
  module.exports = open;
  