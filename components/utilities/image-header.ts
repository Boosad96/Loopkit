type DetectedImage = { width: number; height: number };
export function imageDimensions(data: DataView, type: string): DetectedImage {
  const text = (offset: number, length: number) =>
    String.fromCharCode(
      ...new Uint8Array(data.buffer, data.byteOffset + offset, length),
    );
  if (
    type === "image/png" &&
    data.byteLength >= 33 &&
    data.getUint32(0) === 0x89504e47 &&
    data.getUint32(4) === 0x0d0a1a0a &&
    text(12, 4) === "IHDR"
  ) {
    for (let offset = 8; offset + 12 <= data.byteLength;) {
      const chunk = text(offset + 4, 4);
      if (chunk === "acTL")
        throw new Error(
          "Choose a still image. Animated images are unsupported.",
        );
      if (chunk === "IDAT" || chunk === "IEND") break;
      offset += data.getUint32(offset) + 12;
    }
    return { width: data.getUint32(16), height: data.getUint32(20) };
  }
  if (
    type === "image/webp" &&
    data.byteLength >= 30 &&
    text(0, 4) === "RIFF" &&
    text(8, 4) === "WEBP"
  ) {
    const kind = text(12, 4);
    if (kind === "VP8X") {
      if (data.getUint8(20) & 2)
        throw new Error(
          "Choose a still image. Animated images are unsupported.",
        );
      const u24 = (offset: number) =>
        data.getUint16(offset, true) + (data.getUint8(offset + 2) << 16);
      return { width: 1 + u24(24), height: 1 + u24(27) };
    }
    if (kind === "VP8L" && data.getUint8(20) === 0x2f) {
      const bits = data.getUint32(21, true);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
    if (
      kind === "VP8 " &&
      data.getUint8(23) === 0x9d &&
      data.getUint16(24) === 0x012a
    )
      return {
        width: data.getUint16(26, true) & 0x3fff,
        height: data.getUint16(28, true) & 0x3fff,
      };
  }
  if (
    type === "image/jpeg" &&
    data.byteLength >= 12 &&
    data.getUint16(0) === 0xffd8
  ) {
    let offset = 2;
    while (offset + 4 <= data.byteLength && data.getUint8(offset) === 0xff) {
      while (offset < data.byteLength && data.getUint8(offset) === 0xff)
        offset++;
      if (offset + 3 > data.byteLength) break;
      const marker = data.getUint8(offset++),
        length = data.getUint16(offset);
      if (
        marker === 0xda ||
        marker === 0xd9 ||
        length < 2 ||
        offset + length > data.byteLength
      )
        break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker) &&
        length >= 8
      )
        return {
          height: data.getUint16(offset + 3),
          width: data.getUint16(offset + 5),
        };
      offset += length;
    }
  }
  throw new Error("Unable to read this file as a supported static image.");
}
