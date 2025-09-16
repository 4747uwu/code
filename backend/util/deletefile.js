const fs = require("fs");

exports.deleteFile = (file) => {
  console.log("file in delete function ===========", file);

  if (file && fs.existsSync(file?.path)) {
    fs.unlinkSync(file.path);
  }
};

exports.deleteFiles = (files) => {
  console.log("files in delete function ===========", files);

  if (files?.photoGallery) {
    files?.photoGallery.forEach((file) => this.deleteFile(file));
  }

  if (files?.identityProof) {
    files?.identityProof.forEach((file) => this.deleteFile(file));
  }

  if (files?.image) {
    files?.image.forEach((file) => this.deleteFile(file));
  }

  if (files?.svgaImage) {
    files?.svgaImage.forEach((file) => this.deleteFile(file));
  }
};
