/*
 Copyright (c) 2019-2020 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
 worldwide, royalty-free, non-assignable, revocable and non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
 not use Cocos Creator software for developing other software or tools that's
 used for developing games. You are not granted to publish, distribute,
 sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

/**
 * @packageDocumentation
 * @module ui
 */
import { BufferUsageBit, MemoryUsageBit, InputAssemblerInfo, Attribute, Buffer, BufferInfo, InputAssembler } from '../../core/gfx';
import { legacyCC } from '../../core/global-exports';
import { getComponentPerVertex } from './vertex-format';

export class MeshBuffer {
    get attributes () { return this._attributes; }
    get vertexBuffers () { return this._vertexBuffers; }
    get indexBuffer () { return this._indexBuffer; }

    public vData: Float32Array | null = null;
    public iData: Uint16Array | null = null;

    public byteStart = 0;
    public byteOffset = 0;
    public indicesStart = 0;
    public indicesOffset = 0;
    public vertexStart = 0;
    public vertexOffset = 0;

    private _attributes: Attribute[] = null!;
    private _vertexBuffers: Buffer[] = [];
    private _indexBuffer: Buffer = null!;
    private _iaInfo: InputAssemblerInfo = null!;

    // NOTE:
    // actually 256 * 4 * (vertexFormat._bytes / 4)
    // include pos, uv, color in ui attributes
    private _dirty = false;
    private _vertexFormatBytes = 0;
    private _verticesCount = 0;
    private _indicesCount = 0;
    private _hInputAssemblers: InputAssembler[] = [];
    private _nextFreeIAHandle = 0;
    private _vbInfos: Array<{ start: number, end: number, dirty: false }> = [];
    private _curVBInfo: { start: number, end: number, dirty: false } | null = null;

    get vertexFormatBytes (): number {
        return this._vertexFormatBytes;
    }

    public recreateIfNeed (attrs: Attribute[], verticesCount: number = 0, indicesCount: number = 0) {
        if (attrs === this._attributes && this._verticesCount === verticesCount && this._indicesCount === indicesCount) {
            return;
        }
        const formatBytes = getComponentPerVertex(attrs);
        this._vertexFormatBytes = formatBytes * Float32Array.BYTES_PER_ELEMENT;
        this._verticesCount = verticesCount;
        this._indicesCount = indicesCount;

        if (!this.vertexBuffers.length) {
            this.vertexBuffers.push(legacyCC.director.root.device.createBuffer(new BufferInfo(
                BufferUsageBit.VERTEX | BufferUsageBit.TRANSFER_DST,
                MemoryUsageBit.HOST | MemoryUsageBit.DEVICE,
                this._vertexFormatBytes,
                this._vertexFormatBytes,
            )));
            this._curVBInfo = { start: 0, end: 0, dirty: false };
            this._vbInfos.push(this._curVBInfo);
        }

        const ibStride = Uint16Array.BYTES_PER_ELEMENT;

        if (!this.indexBuffer) {
            this._indexBuffer = legacyCC.director.root.device.createBuffer(new BufferInfo(
                BufferUsageBit.INDEX | BufferUsageBit.TRANSFER_DST,
                MemoryUsageBit.HOST | MemoryUsageBit.DEVICE,
                ibStride,
                ibStride,
            ));
        }

        this._attributes = attrs;
        this._iaInfo = new InputAssemblerInfo(this.attributes, this.vertexBuffers, this.indexBuffer);

        this._reallocBuffer();
    }

    public request (vertexCount = 4, indicesCount = 6) {
        if (vertexCount + this.vertexOffset > 65535) {
            return false;
        }

        this.vertexOffset += vertexCount;
        this.indicesOffset += indicesCount;
        this.byteOffset = this.byteOffset + vertexCount * this._vertexFormatBytes;

        this._dirty = true;
        return true;
    }

    public switchBufferAndReset () {

        this._vbInfos[this._vbInfos.length - 1].end = this.byteOffset >> 2;
        const nextVB = legacyCC.director.root.device.createBuffer(new BufferInfo(
            BufferUsageBit.VERTEX | BufferUsageBit.TRANSFER_DST,
            MemoryUsageBit.HOST | MemoryUsageBit.DEVICE,
            this._vertexFormatBytes,
            this._vertexFormatBytes,
        ));
        this._vertexBuffers.push(nextVB);
        this._vbInfos.push({ start: this.byteOffset >> 2, end: this.byteOffset >> 2, dirty: false });
        this._iaInfo = new InputAssemblerInfo(this.attributes, [nextVB], this.indexBuffer);
        this.vertexOffset = 0;
    }

    public reset () {
        this.byteStart = 0;
        this.byteOffset = 0;
        this.indicesStart = 0;
        this.indicesOffset = 0;
        this.vertexStart = 0;
        this.vertexOffset = 0;
        this._nextFreeIAHandle = 0;

        this._dirty = false;
    }

    public destroy () {
        this._attributes = null!;

        this.vertexBuffers[0].destroy();
        this.vertexBuffers.length = 0;

        this.indexBuffer.destroy();
        this._indexBuffer = null!;

        for (let i = 0; i < this._hInputAssemblers.length; i++) {
            this._hInputAssemblers[i].destroy();
        }
        this._hInputAssemblers.length = 0;
    }

    public recordBatch (): InputAssembler | null {
        const vCount = this.indicesOffset - this.indicesStart;
        if (!vCount) {
            return null;
        }

        if (this._hInputAssemblers.length <= this._nextFreeIAHandle) {
            this._hInputAssemblers.push(legacyCC.director.root.device.createInputAssembler(this._iaInfo));
        }

        const ia = this._hInputAssemblers[this._nextFreeIAHandle++];

        ia.firstIndex = this.indicesStart;
        ia.indexCount = vCount;

        this.vertexStart = this.vertexOffset;
        this.indicesStart = this.indicesOffset;
        this.byteStart = this.byteOffset;

        return ia;
    }

    public uploadBuffers () {
        if (this.byteOffset === 0 || !this._dirty) {
            return;
        }

        for (let i = 0; i < this._vbInfos.length; i++) {
            const vbInfo = this._vbInfos[i];
            const size = vbInfo.end - vbInfo.start;
            const verticesData = new Float32Array(this.vData!.buffer, vbInfo.start, size);

            if (size > this.vertexBuffers[i].size) {
                this.vertexBuffers[i].resize(size);
            }
            this.vertexBuffers[i].update(verticesData);
        }

        const indicesData = new Uint16Array(this.iData!.buffer, 0, this.indicesOffset);
        if (this.indicesOffset * 2 > this.indexBuffer.size) {
            this.indexBuffer.resize(this.indicesOffset * 2);
        }
        this.indexBuffer.update(indicesData);
        this._dirty = false;
    }

    private _reallocBuffer () {
        this._reallocVData();
        this._reallocIData();
    }

    private _reallocVData () {
        this.vData = new Float32Array(this._verticesCount * this._vertexFormatBytes);
    }

    private _reallocIData () {
        this.iData = new Uint16Array(this._indicesCount);
    }
}
