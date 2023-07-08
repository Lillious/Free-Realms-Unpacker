const fs = require('fs');
const path = require('path');
const cores = require('os').cpus().length;
const cluster = require('cluster');

if (cluster.isMaster) {
  const files = process.argv[2] ? [process.argv[2]] : getFiles('input');
  const filesPerCore = Math.floor(files.length / cores);
  const remainder = files.length % cores;
  let start = 0;
  let end = filesPerCore + remainder;
  for (let i = 0; i < cores; i++) {
    const worker = cluster.fork();
    worker.send(files.slice(start, end));
    start = end;
    end += filesPerCore;
  }
}

if (cluster.isWorker) {
  process.on('message', (files) => {
    files.forEach((file) => {
      const packFile = new PackFile(file);
      packFile.writeFilesToOutputDirectory();
    });

    
    process.exit(1);
  });
}

class FileData {
    constructor(offset, size, i3) {
      this.offset = offset;
      this.size = size;
      this.i3 = i3;
    }
  }
  
class PackFile {
  constructor(filename) {
    this.filename = filename;
    this.filenames = [];
    this.fileData = [];
    this.files = 0;

    let num = 5;

    if (!filename.endsWith('.pack')) return;

    if (fs.statSync(filename).isDirectory()) return;

    const fileData = fs.readFileSync(filename);
    const binaryReader = new BinaryReader(fileData);

    try {
        while (true) {
        const header = binaryReader.readInt32BE();
        if (header === 0) {
            break;
        }
        const filesInPack = binaryReader.readInt32BE();
        num = filesInPack;
        for (let i = 0; i < num; i++) {
            const item = binaryReader.readString();
            this.filenames.push(item);
            const fileDataItem = new FileData(
            binaryReader.readInt32BE(),
            binaryReader.readInt32BE(),
            binaryReader.readInt32BE()
            );
            this.fileData.push(fileDataItem);
            this.files++;
        }
        binaryReader.seek(header);
        }
    } catch (err) {
        if (err) {
            console.log(`An error occured while unpacking ${filename}`);
        }
    }
  }

    writeFilesToOutputDirectory() {
        const outputDirectory = 'output';
        const assetDirectory = 'assets';

        if (!fs.existsSync(assetDirectory)) {
            fs.mkdirSync(assetDirectory);
        }

        if (!fs.existsSync(outputDirectory)) {
          fs.mkdirSync(outputDirectory);
        }
    
        for (let i = 0; i < this.files; i++) {
          const filename = this.filenames[i];
          const fileData = this.fileData[i];
    
          const outputFile = path.join(outputDirectory, filename);
          const inputFile = fs.openSync(this.filename, 'r');
          const outputFileDescriptor = fs.openSync(outputFile, 'w');
    
          const buffer = Buffer.alloc(fileData.size);
          fs.readSync(inputFile, buffer, 0, fileData.size, fileData.offset);
          fs.writeSync(outputFileDescriptor, buffer, 0, fileData.size, 0);
    
          fs.closeSync(inputFile);
          fs.closeSync(outputFileDescriptor);
          console.log(`Unpacked ${filename}`);
          // Split out every extension into a sub folder
          const extension = path.extname(filename);
          const extensionDirectory = path.join(assetDirectory, extension);
          if (!fs.existsSync(extensionDirectory)) {
            fs.mkdirSync(extensionDirectory);
          }
          const extensionOutputFile = path.join(extensionDirectory, filename);
          fs.copyFileSync(outputFile, extensionOutputFile);
        }
    }
}

class BinaryReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }

  readInt32BE() {
    const value = this.buffer.readInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  readString() {
    const stringLength = this.readInt32BE();
    const stringBuffer = this.buffer.slice(this.offset, this.offset + stringLength);
    this.offset += stringLength;
    return stringBuffer.toString('utf8');
  }

  seek(position) {
    this.offset = position;
  }
}

function getFiles(dir, files_) {
    files_ = files_ || [];
    const files = fs.readdirSync(dir);
    for (const i in files) {
        const name = dir + '\\' + files[i];
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, files_);
        } else {
            files_.push(name);
        }
    }
    return files_;
}
