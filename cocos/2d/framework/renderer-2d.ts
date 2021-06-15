import { Color, Material, Texture2D, Vec2, Vec3 } from "../../core";
import { BlendFactor } from "../../core/gfx/base/define";
import { NodeEventType } from "../../core/scene-graph/node-event";
import { RenderGroup2D } from "./render-group-2d";
import { RenderRoot2D } from "./render-root-2d";
import { TreeNode2D } from './tree-node';

const colorFactor = 1 / 255;
const temp = new Vec3();

export class Renderer2D extends TreeNode2D {

    public static globalVersion = 0
    
    public set texture (val: Texture2D) {
        if (this._texture !== val) {
            this._texture = val;
            this.root.batchDirty = true;
        }
    }

    public set material (val: Material) {
        if (val !== this._material) {
            this._material = val;
            this._batchHash |= this._material.id << 16;
            this.root.batchDirty = true;
        }
    }

    public set blendSrcFactor (val: BlendFactor) {
        if (val !== this._blendSrcFactor) {
            this._blendSrcFactor = val;
            this._batchHash |= this.blendSrcFactor << 4;
            this.root.batchDirty = true;
        }
    }

    public set blendDstFactor (val: BlendFactor) {
        if (val !== this._blendDstFactor) {
            this._blendDstFactor = val;
            this._batchHash |= this.blendSrcFactor;
            this.root.batchDirty = true;
        }
    }

    public set layer (val: number) {
        if (this._layer !== val) {
            this._layer = val;
            this._batchHash |= this._layer << 8;
            this.root.batchDirty = true;
        }
    }

    public set color (val: Color) {
        if (!this._color.equals(val)) {
            this._color.set(val);
            this.root.colorDirtyRenderers.push(this);
        }
    }

    public set vertices (vertices: Vec2[]) {
        this._vertices = vertices;
        this.root.verticesDirtyRenderers.push(this);
    }

    public set uvs (uvs: Vec2[]) {
        this.uvs = uvs;
        this.root.uvDirtyRenderers.push(this);
    }

    public set indices (indices: number[]) {
        this._indices = indices;
        this.root.indicesDirtyRenderers.push(this);
    }

    public set verticesCount (val: number) {
        if (this._verticesCount !== val) {
            this._verticesCount = val;
            this._verticesData = new Float32Array(val * 9);
            this.root.batchDirty = true;
        }
    }

    public set indicesCount (val: number) {
        if (this._indicesCount !== val) {
            this._indicesCount = val;
            this._indicesData = new Uint16Array(val);
            this.root.batchDirty = true;
        }
    }

    private _layer: number = 0;
    private _material: Material | null = null;
    private _texture: Texture2D | null = null;
    private _blendSrcFactor: BlendFactor = BlendFactor.SRC_ALPHA;
    private _blendDstFactor: BlendFactor = BlendFactor.ONE_MINUS_SRC_ALPHA;
    private _color: Color = Color.WHITE;
    private _verticesData: Float32Array = new Float32Array(4 * 9);
    private _indicesData: Uint16Array = new Uint16Array(6);
    private _vertices: Vec2[] = [];
    private _uvs: Vec2[] = [];
    private _indices: number[] = [];
    private _root: RenderGroup2D | null = null;
    public _batchHash: number = 0;
    
    private _verticesCount = 0;
    private _indicesCount = 0;

    onEnable () {
        super.onEnable();
        this.layer = this.node.layer;
        this.node.on(NodeEventType.LAYER_CHANGED, this.onLayerChanged, this);
        this.root.batchDirty = true;
    }

    onDisable () {
        this.node.off(NodeEventType.LAYER_CHANGED, this.onLayerChanged, this);
        this.root.batchDirty = true;
    }

    onLayerChanged () {
        this.layer = this.node.layer;
        this.root.batchDirty = true;
        this.root.batchDirty = true;
    }

    updateColor () {
        const colorOffset = 5;
        const colorR = this._color.r * colorFactor;
        const colorG = this._color.g * colorFactor;
        const colorB = this._color.b * colorFactor;
        const colorA = this._color.a * colorFactor;
        for (let i = 0; i < this.verticesCount; i++) {
            const base = i * 9;
            this._verticesData[base + colorOffset] = colorR;
            this._verticesData[base + colorOffset + 1] = colorG; 
            this._verticesData[base + colorOffset + 2] = colorB; 
            this._verticesData[base + colorOffset + 3] = colorA; 
        }
    }

    updateVertices () {
        for (let i = 0; i < this.verticesCount; i++) {
            const base = i * 9;
            Vec2.transformMat4(temp, this._vertices[i], this.node.worldMatrix);
            this._verticesData[base + 1] = temp.x; 
            this._verticesData[base + 2] = temp.y; 
            this._verticesData[base + 3] = temp.z; 
        }
    }

    updateUvs () {
        for (let i = 0; i < this.verticesCount; i++) {
            const base = i * 9;
            this._verticesData[base + 3] = this._uvs[i].x; 
            this._verticesData[base + 4] = this._uvs[i].y; 
        }
    }

    updateIndices () {
        for (let i = 0; i < this.indicesCount; i++) {
            this._indicesData[i] = this._indices[i];
        }
    }

    updateBatch () {
        if (this._root) {
            this._root.batchDirty = true;
        }
    }

    updateBuffer () {

    }

    fillBuffer () {
        let buffer = this.root.acquireBufferBatch()!;

        let vertexOffset = buffer.byteOffset >> 2;
        let indicesOffset = buffer.indicesOffset;
        let vertexId = buffer.vertexOffset;

        const isRecreate = buffer.request();
        if (!isRecreate) {
            buffer = this.root.currBufferBatch!;
            vertexOffset = 0;
            indicesOffset = 0;
            vertexId = 0;
        }
    }
}