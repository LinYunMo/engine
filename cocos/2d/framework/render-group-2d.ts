import { DrawBatch2D } from "../renderer/draw-batch";
import { MeshBuffer } from "../renderer/mesh-buffer";
import { Renderer2D } from "./renderer-2d";
import { TreeNode2D } from "./tree-node";
import * as VertexFormat from '../renderer/vertex-format';
import { legacyCC } from "../../core/global-exports";

export class RenderGroupInfo {
    public batchDirty = true;
    public orderDirty = true;
    public verticesDataCount = 0;
    public indicesDataCount = 0;
    public meshBuffer: MeshBuffer = new MeshBuffer();
    public colorDirtyRenderers: Renderer2D[] = [];
    public verticesDirtyRenderers: Renderer2D[] = [];
    public uvDirtyRenderers: Renderer2D[] = [];
    public indicesDirtyRenderers: Renderer2D[] = [];
    public bufferDirtyRenderers: Renderer2D[] = [];

    reset () {
        this.colorDirtyRenderers.length = 0;
        this.verticesDirtyRenderers.length = 0;
        this.uvDirtyRenderers.length = 0;
        this.indicesDirtyRenderers.length = 0;
        this.bufferDirtyRenderers.length = 0;
    }
}
export class RenderGroup2D extends TreeNode2D {
    public shouldCulling = false;
    public sortedRenderers: Renderer2D[] = [];
    public drawBatches: DrawBatch2D[] = [];
    public renderGroupInfo = new RenderGroupInfo();

    public updateAllDirtyRenderer () {
        const colorDirtyRenderer = this.renderGroupInfo.colorDirtyRenderers;
        for (let i = 0; i < colorDirtyRenderer.length; i++) {
            colorDirtyRenderer[i].updateColor();
        }
        const verticesDirtyRenderers = this.renderGroupInfo.verticesDirtyRenderers;
        for (let i = 0; i < verticesDirtyRenderers.length; i++) {
            verticesDirtyRenderers[i].updateVertices();
        }
        const uvDirtyRenderers = this.renderGroupInfo.uvDirtyRenderers;
        for (let i = 0; i < uvDirtyRenderers.length; i++) {
            uvDirtyRenderers[i].updateUvs();
        }
        const indicesDirtyRenderers = this.renderGroupInfo.indicesDirtyRenderers;
        for (let i = 0; i < indicesDirtyRenderers.length; i++) {
            indicesDirtyRenderers[i].updateIndices();
        }
    }

    public updateOrderIfNeed () {
        if (this.renderGroupInfo.orderDirty) {
            this.sortedRenderers.length = 0;
            this.renderGroupInfo.verticesDataCount = 0;
            this.renderGroupInfo.indicesDataCount = 0;
            const temp: TreeNode2D[] = [];
            temp.push(this);
            while (temp.length > 0) {
                const treenode = temp.pop()!;
                const children = treenode.children;
                for (let i = children.length - 1; i >= 0; i--) {
                    temp.push(children[i]);
                }
                treenode.root = this.renderGroupInfo;
                if (treenode instanceof Renderer2D && treenode.isVisible) { 
                    this.sortedRenderers.push(treenode);
                    this.renderGroupInfo.verticesDataCount += treenode.verticesCount * 9;
                    this.renderGroupInfo.indicesDataCount += treenode.indicesCount;
                }
            }
            this.renderGroupInfo.orderDirty = false;
            this.renderGroupInfo.batchDirty = true;
        }
    }

    public generateBatchesIfNeed () {
        if (this.renderGroupInfo.batchDirty && this.sortedRenderers.length > 0) {
            this.drawBatches.length = 0;
            let lastRenderer = this.sortedRenderers[0];
            let lastTexture = lastRenderer.texture;
            let lastBatchHash = lastRenderer._batchHash;
            this.renderGroupInfo.meshBuffer.request(lastRenderer.verticesCount, lastRenderer.indicesCount)
            lastRenderer.fillBuffer();

            for (let i = 1, l = this.sortedRenderers.length; i < l; i++) {
                const renderer  = this.sortedRenderers[i];
                const texture = renderer.texture;

                const bufferExceedMaxSize = !this.renderGroupInfo.meshBuffer.request(renderer.verticesCount, renderer.indicesCount)

                if (lastTexture !== texture || lastBatchHash !== renderer._batchHash || bufferExceedMaxSize) {
                    this.autoMergeBatches(lastRenderer);
                    lastTexture = texture;
                    lastBatchHash = renderer._batchHash;
                    lastRenderer = renderer;
                }

                if (bufferExceedMaxSize) {
                    this.renderGroupInfo.meshBuffer.switchBufferAndReset();
                }

                renderer.fillBuffer();
            }
            this.autoMergeBatches(lastRenderer);
            this.renderGroupInfo.bufferDirtyRenderers.length = 0;
            this.renderGroupInfo.batchDirty = false;
        }
    }

    public updateBatches () {
        this.updateOrderIfNeed();
        this.updateAllDirtyRenderer();
        this.prepareBufferIfNeed();
        this.generateBatchesIfNeed();
        
        for (let i = 0; i < this.renderGroupInfo.bufferDirtyRenderers.length; i++) {
            this.renderGroupInfo.bufferDirtyRenderers[i].updateBuffer();
        }

        this.renderGroupInfo.meshBuffer.uploadBuffers();
        this.renderGroupInfo.reset();
    }

    public autoMergeBatches (renderComp: Renderer2D) {
        const buffer = this.renderGroupInfo.meshBuffer;
        const ia = buffer.recordBatch();
        const mat = renderComp.material;
        let blendState;
        let depthStencil;
        let dssHash = 0;
        let bsHash = 0;

        const curDrawBatch = new DrawBatch2D();
        curDrawBatch.renderScene = this._getRenderScene();
        curDrawBatch.visFlags = renderComp.layer;
        curDrawBatch.bufferBatch = buffer;
        curDrawBatch.texture = renderComp.texture.getGFXTexture();
        curDrawBatch.sampler = renderComp.texture.getGFXSampler();
        curDrawBatch.inputAssembler = ia;
        curDrawBatch.useLocalData = null;
        curDrawBatch.textureHash = renderComp.texture.getHash();
        curDrawBatch.samplerHash = renderComp.texture.getSamplerHash();
        curDrawBatch.fillPasses(mat, depthStencil, dssHash, blendState, bsHash, null);

        this.drawBatches.push(curDrawBatch);
    }

    prepareBufferIfNeed () {
        this.renderGroupInfo.meshBuffer.recreateIfNeed(VertexFormat.vfmtPosUvColor, this.renderGroupInfo.verticesDataCount, this.indicesDataCount);
    }

    public onEnable () {
        legacyCC.director.root!.batcher2D.addScreen(this);
    }

    public onDisable () {
        legacyCC.director.root!.batcher2D.removeScreen(this);
    }

    public onDestroy () {
        legacyCC.director.root!.batcher2D.removeScreen(this);
    }
}