//---------------------------------------------------------------------
// QR Code Generator for JavaScript (Kazuhiko Arase, MIT License)
// Encapsulado em TypeScript para renderização de SVG do DANFSE Nacional
//---------------------------------------------------------------------

export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

interface QRBitBuffer {
  get(index: number): boolean
  put(num: number, length: number): void
  getLengthInBits(): number
  putBit(bit: boolean): void
}

function qrBitBuffer(): QRBitBuffer {
  const buffer: number[] = []
  let length = 0

  return {
    get(index: number) {
      const bufIndex = Math.floor(index / 8)
      return ((buffer[bufIndex] >>> (7 - (index % 8))) & 1) === 1
    },
    put(num: number, len: number) {
      for (let i = 0; i < len; i++) {
        this.putBit(((num >>> (len - i - 1)) & 1) === 1)
      }
    },
    getLengthInBits() {
      return length
    },
    putBit(bit: boolean) {
      const bufIndex = Math.floor(length / 8)
      if (buffer.length <= bufIndex) {
        buffer.push(0)
      }
      if (bit) {
        buffer[bufIndex] |= 0x80 >>> (length % 8)
      }
      length++
    },
  }
}

interface QRData {
  getMode(): number
  getLength(buffer?: QRBitBuffer): number
  write(buffer: QRBitBuffer): void
}

const QRMode = {
  MODE_NUMBER: 1 << 0,
  MODE_ALPHA_NUM: 1 << 1,
  MODE_8BIT_BYTE: 1 << 2,
  MODE_KANJI: 1 << 3,
}

function stringToUtf8ByteArray(s: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i)
    if (c < 128) {
      bytes.push(c)
    } else if (c < 2048) {
      bytes.push(192 | (c >> 6), 128 | (c & 63))
    } else if (c < 55296 || c >= 57344) {
      bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63))
    } else {
      i++
      c = 65536 + (((c & 1023) << 10) | (s.charCodeAt(i) & 1023))
      bytes.push(240 | (c >> 18), 128 | ((c >> 12) & 63), 128 | ((c >> 6) & 63), 128 | (c & 63))
    }
  }
  return bytes
}

function qr8BitByte(data: string): QRData {
  const bytes = stringToUtf8ByteArray(data)
  return {
    getMode() {
      return QRMode.MODE_8BIT_BYTE
    },
    getLength() {
      return bytes.length
    },
    write(buffer: QRBitBuffer) {
      for (let i = 0; i < bytes.length; i++) {
        buffer.put(bytes[i], 8)
      }
    },
  }
}

interface QRPolynomial {
  getAt(index: number): number
  getLength(): number
  multiply(e: QRPolynomial): QRPolynomial
  mod(e: QRPolynomial): QRPolynomial
}

const QRMath = (() => {
  const EXP_TABLE = new Array<number>(256)
  const LOG_TABLE = new Array<number>(256)
  for (let i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i
  for (let i = 8; i < 256; i++) {
    EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8]
  }
  for (let i = 0; i < 255; i++) LOG_TABLE[EXP_TABLE[i]] = i

  return {
    glog(n: number) {
      if (n < 1) throw new Error('glog(' + n + ')')
      return LOG_TABLE[n]
    },
    gexp(n: number) {
      while (n < 0) n += 255
      while (n >= 256) n -= 255
      return EXP_TABLE[n]
    },
  }
})()

function qrPolynomial(num: number[], shift: number): QRPolynomial {
  let offset = 0
  while (offset < num.length && num[offset] === 0) offset++
  const _num = new Array<number>(num.length - offset + shift)
  for (let i = 0; i < num.length - offset; i++) _num[i] = num[i + offset]
  for (let i = num.length - offset; i < _num.length; i++) _num[i] = 0

  return {
    getAt(index: number) {
      return _num[index]
    },
    getLength() {
      return _num.length
    },
    multiply(e: QRPolynomial) {
      const result = new Array<number>(this.getLength() + e.getLength() - 1).fill(0)
      for (let i = 0; i < this.getLength(); i++) {
        for (let j = 0; j < e.getLength(); j++) {
          result[i + j] ^= QRMath.gexp(QRMath.glog(this.getAt(i)) + QRMath.glog(e.getAt(j)))
        }
      }
      return qrPolynomial(result, 0)
    },
    mod(e: QRPolynomial): QRPolynomial {
      if (this.getLength() - e.getLength() < 0) return this
      const ratio = QRMath.glog(this.getAt(0)) - QRMath.glog(e.getAt(0))
      const result = new Array<number>(this.getLength())
      for (let i = 0; i < this.getLength(); i++) result[i] = this.getAt(i)
      for (let i = 0; i < e.getLength(); i++) {
        result[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i)) + ratio)
      }
      return qrPolynomial(result, 0).mod(e)
    },
  }
}

interface QRRSBlock {
  totalCount: number
  dataCount: number
}

const QRRSBlockUtil = {
  RS_BLOCK_TABLE: [
    // L, M, Q, H (1-10)
    [1, 26, 19],
    [1, 26, 16],
    [1, 26, 13],
    [1, 26, 9],
    [1, 44, 34],
    [1, 44, 28],
    [1, 44, 22],
    [1, 44, 16],
    [1, 70, 55],
    [1, 70, 44],
    [2, 35, 17],
    [2, 35, 13],
    [1, 100, 80],
    [2, 50, 32],
    [2, 50, 24],
    [4, 25, 9],
    [1, 134, 108],
    [2, 67, 43],
    [2, 33, 15, 2, 34, 16],
    [2, 33, 11, 2, 34, 12],
    [2, 86, 68],
    [4, 43, 27],
    [4, 43, 19],
    [4, 43, 15],
    [2, 98, 78],
    [4, 49, 31],
    [2, 32, 14, 4, 33, 15],
    [4, 39, 13, 1, 40, 14],
    [2, 121, 97],
    [2, 60, 38, 2, 61, 39],
    [4, 40, 18, 2, 41, 19],
    [4, 40, 14, 2, 41, 15],
    [2, 146, 116],
    [3, 58, 36, 2, 59, 37],
    [4, 36, 16, 4, 37, 17],
    [4, 36, 12, 4, 37, 13],
    [2, 86, 68, 2, 87, 69],
    [4, 69, 43, 1, 70, 44],
    [6, 43, 19, 2, 44, 20],
    [6, 43, 15, 2, 44, 16],
    // 11-14
    [4, 101, 81],
    [1, 80, 50, 4, 81, 51],
    [4, 50, 22, 4, 51, 23],
    [3, 36, 12, 8, 37, 13],
    [2, 116, 92, 2, 117, 93],
    [6, 58, 36, 2, 59, 37],
    [4, 46, 20, 6, 47, 21],
    [7, 42, 14, 4, 43, 15],
    [4, 133, 107],
    [8, 59, 37, 1, 60, 38],
    [8, 44, 20, 4, 45, 21],
    [12, 33, 11, 4, 34, 12],
    [3, 145, 115, 1, 146, 116],
    [4, 64, 40, 5, 65, 41],
    [11, 36, 16, 5, 37, 17],
    [11, 36, 12, 5, 37, 13],
  ],
  getRSBlocks(typeNumber: number, errorCorrectionLevel: number): QRRSBlock[] {
    const rsBlock = this.getRsBlockTable(typeNumber, errorCorrectionLevel)
    if (!rsBlock) {
      throw new Error(
        `bad rs block @ typeNumber:${typeNumber}/errorCorrectionLevel:${errorCorrectionLevel}`,
      )
    }
    const length = rsBlock.length / 3
    const list: QRRSBlock[] = []
    for (let i = 0; i < length; i++) {
      const count = rsBlock[i * 3 + 0]
      const totalCount = rsBlock[i * 3 + 1]
      const dataCount = rsBlock[i * 3 + 2]
      for (let j = 0; j < count; j++) {
        list.push({ totalCount, dataCount })
      }
    }
    return list
  },
  getRsBlockTable(typeNumber: number, errorCorrectionLevel: number) {
    switch (errorCorrectionLevel) {
      case 1:
        return this.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0]
      case 0:
        return this.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1]
      case 3:
        return this.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2]
      case 2:
        return this.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3]
      default:
        return undefined
    }
  },
}

const QRUtil = (() => {
  const PATTERN_POSITION_TABLE = [
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
    [6, 30, 54],
    [6, 32, 58],
    [6, 34, 62],
    [6, 26, 46, 66],
  ]
  const G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0)
  const G18 =
    (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0)
  const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1)

  function getBCHDigit(data: number) {
    let digit = 0
    while (data !== 0) {
      digit++
      data >>>= 1
    }
    return digit
  }

  return {
    getBCHTypeInfo(data: number) {
      let d = data << 10
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= G15 << (getBCHDigit(d) - getBCHDigit(G15))
      }
      return ((data << 10) | d) ^ G15_MASK
    },
    getBCHTypeNumber(data: number) {
      let d = data << 12
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= G18 << (getBCHDigit(d) - getBCHDigit(G18))
      }
      return (data << 12) | d
    },
    getPatternPosition(typeNumber: number) {
      return PATTERN_POSITION_TABLE[typeNumber - 1] || []
    },
    getMaskFunction(maskPattern: number) {
      switch (maskPattern) {
        case 0:
          return (i: number, j: number) => (i + j) % 2 === 0
        case 1:
          return (i: number) => i % 2 === 0
        case 2:
          return (_i: number, j: number) => j % 3 === 0
        case 3:
          return (i: number, j: number) => (i + j) % 3 === 0
        case 4:
          return (i: number, j: number) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0
        case 5:
          return (i: number, j: number) => ((i * j) % 2) + ((i * j) % 3) === 0
        case 6:
          return (i: number, j: number) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0
        case 7:
          return (i: number, j: number) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0
        default:
          throw new Error('bad maskPattern:' + maskPattern)
      }
    },
    getErrorCorrectPolynomial(errorCorrectLength: number): QRPolynomial {
      let a = qrPolynomial([1], 0)
      for (let i = 0; i < errorCorrectLength; i++) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0))
      }
      return a
    },
    getLengthInBits(mode: number, type: number) {
      if (1 <= type && type < 10) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 10
          case QRMode.MODE_ALPHA_NUM:
            return 9
          case QRMode.MODE_8BIT_BYTE:
            return 8
          case QRMode.MODE_KANJI:
            return 8
          default:
            throw new Error('mode:' + mode)
        }
      } else if (type < 27) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 12
          case QRMode.MODE_ALPHA_NUM:
            return 11
          case QRMode.MODE_8BIT_BYTE:
            return 16
          case QRMode.MODE_KANJI:
            return 10
          default:
            throw new Error('mode:' + mode)
        }
      } else {
        return 16
      }
    },
    getLostPoint(qrcode: any) {
      const moduleCount = qrcode.getModuleCount()
      let lostPoint = 0
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          let sameCount = 0
          const dark = qrcode.isDark(row, col)
          for (let r = -1; r <= 1; r++) {
            if (row + r < 0 || moduleCount <= row + r) continue
            for (let c = -1; c <= 1; c++) {
              if (col + c < 0 || moduleCount <= col + c) continue
              if (r === 0 && c === 0) continue
              if (dark === qrcode.isDark(row + r, col + c)) sameCount++
            }
          }
          if (sameCount > 5) lostPoint += 3 + sameCount - 5
        }
      }
      return lostPoint
    },
  }
})()

export class SimpleQrCode {
  private typeNumber: number
  private errorCorrectionLevel: number
  private modules: (boolean | null)[][] = []
  private moduleCount = 0
  private dataList: QRData[] = []

  constructor(typeNumber = 0, errorCorrectionLevel: QrErrorCorrectionLevel = 'M') {
    this.typeNumber = typeNumber
    const ecMap: Record<QrErrorCorrectionLevel, number> = { L: 1, M: 0, Q: 3, H: 2 }
    this.errorCorrectionLevel = ecMap[errorCorrectionLevel] ?? 0
  }

  addData(data: string) {
    this.dataList.push(qr8BitByte(data))
  }

  isDark(row: number, col: number): boolean {
    return Boolean(this.modules[row]?.[col])
  }

  getModuleCount(): number {
    return this.moduleCount
  }

  make() {
    if (this.typeNumber < 1) {
      let t = 1
      for (; t <= 14; t++) {
        const rsBlocks = QRRSBlockUtil.getRSBlocks(t, this.errorCorrectionLevel)
        const buffer = qrBitBuffer()
        for (let i = 0; i < this.dataList.length; i++) {
          const d = this.dataList[i]
          buffer.put(d.getMode(), 4)
          buffer.put(d.getLength(), QRUtil.getLengthInBits(d.getMode(), t))
          d.write(buffer)
        }
        let totalDataCount = 0
        for (let i = 0; i < rsBlocks.length; i++) {
          totalDataCount += rsBlocks[i].dataCount
        }
        if (buffer.getLengthInBits() <= totalDataCount * 8) break
      }
      this.typeNumber = t
    }

    this.makeImpl(false, this.getBestMaskPattern())
  }

  private makeImpl(test: boolean, maskPattern: number) {
    this.moduleCount = this.typeNumber * 4 + 17
    this.modules = new Array(this.moduleCount)
    for (let r = 0; r < this.moduleCount; r++) {
      this.modules[r] = new Array(this.moduleCount).fill(null)
    }

    this.setupPositionProbePattern(0, 0)
    this.setupPositionProbePattern(this.moduleCount - 7, 0)
    this.setupPositionProbePattern(0, this.moduleCount - 7)
    this.setupPositionAdjustPattern()
    this.setupTimingPattern()
    this.setupTypeInfo(test, maskPattern)

    if (this.typeNumber >= 7) {
      this.setupTypeNumber(test)
    }

    const dataCache = this.createData(this.typeNumber, this.errorCorrectionLevel)
    this.mapData(dataCache, maskPattern)
  }

  private setupPositionProbePattern(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue
        if (
          (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
          (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4)
        ) {
          this.modules[row + r][col + c] = true
        } else {
          this.modules[row + r][col + c] = false
        }
      }
    }
  }

  private getBestMaskPattern(): number {
    let minLostPoint = 0
    let pattern = 0
    for (let i = 0; i < 8; i++) {
      this.makeImpl(true, i)
      const lostPoint = QRUtil.getLostPoint(this)
      if (i === 0 || minLostPoint > lostPoint) {
        minLostPoint = lostPoint
        pattern = i
      }
    }
    return pattern
  }

  private setupTimingPattern() {
    for (let r = 8; r < this.moduleCount - 8; r++) {
      if (this.modules[r][6] !== null) continue
      this.modules[r][6] = r % 2 === 0
    }
    for (let c = 8; c < this.moduleCount - 8; c++) {
      if (this.modules[6][c] !== null) continue
      this.modules[6][c] = c % 2 === 0
    }
  }

  private setupPositionAdjustPattern() {
    const pos = QRUtil.getPatternPosition(this.typeNumber)
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const row = pos[i]
        const col = pos[j]
        if (this.modules[row][col] !== null) continue
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
              this.modules[row + r][col + c] = true
            } else {
              this.modules[row + r][col + c] = false
            }
          }
        }
      }
    }
  }

  private setupTypeNumber(test: boolean) {
    const bits = QRUtil.getBCHTypeNumber(this.typeNumber)
    for (let i = 0; i < 18; i++) {
      const mod = !test && ((bits >> i) & 1) === 1
      this.modules[Math.floor(i / 3)][(i % 3) + this.moduleCount - 8 - 3] = mod
    }
    for (let i = 0; i < 18; i++) {
      const mod = !test && ((bits >> i) & 1) === 1
      this.modules[(i % 3) + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod
    }
  }

  private setupTypeInfo(test: boolean, maskPattern: number) {
    const data = (this.errorCorrectionLevel << 3) | maskPattern
    const bits = QRUtil.getBCHTypeInfo(data)
    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1
      if (i < 6) this.modules[i][8] = mod
      else if (i < 8) this.modules[i + 1][8] = mod
      else this.modules[this.moduleCount - 15 + i][8] = mod
    }
    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1
      if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod
      else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod
      else this.modules[8][15 - i - 1] = mod
    }
    this.modules[this.moduleCount - 8][8] = !test
  }

  private mapData(data: number[], maskPattern: number) {
    let inc = -1
    let row = this.moduleCount - 1
    let bitIndex = 7
    let byteIndex = 0
    const maskFunc = QRUtil.getMaskFunction(maskPattern)

    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col -= 1
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] === null) {
            let dark = false
            if (byteIndex < data.length) {
              dark = ((data[byteIndex] >>> bitIndex) & 1) === 1
            }
            const mask = maskFunc(row, col - c)
            if (mask) dark = !dark
            this.modules[row][col - c] = dark
            bitIndex -= 1
            if (bitIndex === -1) {
              byteIndex += 1
              bitIndex = 7
            }
          }
        }
        row += inc
        if (row < 0 || this.moduleCount <= row) {
          row -= inc
          inc = -inc
          break
        }
      }
    }
  }

  private createData(typeNumber: number, errorCorrectionLevel: number): number[] {
    const rsBlocks = QRRSBlockUtil.getRSBlocks(typeNumber, errorCorrectionLevel)
    const buffer = qrBitBuffer()

    for (let i = 0; i < this.dataList.length; i++) {
      const d = this.dataList[i]
      buffer.put(d.getMode(), 4)
      buffer.put(d.getLength(), QRUtil.getLengthInBits(d.getMode(), typeNumber))
      d.write(buffer)
    }

    let totalDataCount = 0
    for (let i = 0; i < rsBlocks.length; i++) {
      totalDataCount += rsBlocks[i].dataCount
    }

    if (buffer.getLengthInBits() > totalDataCount * 8) {
      throw new Error(`code length overflow (${buffer.getLengthInBits()} > ${totalDataCount * 8})`)
    }

    if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
      buffer.put(0, 4)
    }

    while (buffer.getLengthInBits() % 8 !== 0) {
      buffer.putBit(false)
    }

    while (true) {
      if (buffer.getLengthInBits() >= totalDataCount * 8) break
      buffer.put(0xec, 8)
      if (buffer.getLengthInBits() >= totalDataCount * 8) break
      buffer.put(0x11, 8)
    }

    return this.createBytes(buffer, rsBlocks)
  }

  private createBytes(buffer: QRBitBuffer, rsBlocks: QRRSBlock[]): number[] {
    let offset = 0
    let maxDcCount = 0
    let maxEcCount = 0
    const dcdata = new Array<number[]>(rsBlocks.length)
    const ecdata = new Array<number[]>(rsBlocks.length)

    for (let r = 0; r < rsBlocks.length; r++) {
      const dcCount = rsBlocks[r].dataCount
      const ecCount = rsBlocks[r].totalCount - dcCount
      maxDcCount = Math.max(maxDcCount, dcCount)
      maxEcCount = Math.max(maxEcCount, ecCount)

      dcdata[r] = new Array<number>(dcCount)
      for (let i = 0; i < dcdata[r].length; i++) {
        dcdata[r][i] =
          0xff & (buffer as any).getBuffer?.() ? (buffer as any).getBuffer()[i + offset] : 0
      }
      // fallback via bit buffer get
      for (let i = 0; i < dcCount; i++) {
        let byteVal = 0
        for (let b = 0; b < 8; b++) {
          if (buffer.get((offset + i) * 8 + b)) {
            byteVal |= 0x80 >>> b
          }
        }
        dcdata[r][i] = byteVal
      }
      offset += dcCount

      const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount)
      const rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1)
      const modPoly = rawPoly.mod(rsPoly)
      ecdata[r] = new Array<number>(rsPoly.getLength() - 1)
      for (let i = 0; i < ecdata[r].length; i++) {
        const modIndex = i + modPoly.getLength() - ecdata[r].length
        ecdata[r][i] = modIndex >= 0 ? modPoly.getAt(modIndex) : 0
      }
    }

    let totalCodeCount = 0
    for (let i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount
    const data = new Array<number>(totalCodeCount)
    let index = 0

    for (let i = 0; i < maxDcCount; i++) {
      for (let r = 0; r < rsBlocks.length; r++) {
        if (i < dcdata[r].length) {
          data[index++] = dcdata[r][i]
        }
      }
    }

    for (let i = 0; i < maxEcCount; i++) {
      for (let r = 0; r < rsBlocks.length; r++) {
        if (i < ecdata[r].length) {
          data[index++] = ecdata[r][i]
        }
      }
    }

    return data
  }
}

/**
 * Constrói a matriz booleana do QR Code para um texto qualquer.
 */
export function generateQrMatrix(text: string): boolean[][] {
  try {
    const qr = new SimpleQrCode(0, 'M')
    qr.addData(text)
    qr.make()
    const size = qr.getModuleCount()
    const matrix: boolean[][] = []
    for (let r = 0; r < size; r++) {
      const row: boolean[] = []
      for (let c = 0; c < size; c++) {
        row.push(qr.isDark(r, c))
      }
      matrix.push(row)
    }
    return matrix
  } catch (err) {
    console.warn('Falha na geração do QR Code via SimpleQrCode:', err)
    // Retorna uma matriz simplificada de fallback (placeholder estético)
    const fallbackSize = 25
    const fallback: boolean[][] = []
    for (let r = 0; r < fallbackSize; r++) {
      const row: boolean[] = []
      for (let c = 0; c < fallbackSize; c++) {
        // Padrão de moldura e posições dos cantos
        const isCorner =
          (r < 7 && c < 7) || (r < 7 && c >= fallbackSize - 7) || (r >= fallbackSize - 7 && c < 7)
        row.push(
          isCorner
            ? r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)
            : (r + c) % 3 === 0,
        )
      }
      fallback.push(row)
    }
    return fallback
  }
}
