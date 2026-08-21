importScripts("/vendor/jsQR.js");

const decode = self.jsQR.default ?? self.jsQR;

self.onmessage = ({ data: frame }) => {
  const found = decode(frame.data, frame.width, frame.height, {
    inversionAttempts: "dontInvert",
  });
  self.postMessage(found ? found.data : null);
};
