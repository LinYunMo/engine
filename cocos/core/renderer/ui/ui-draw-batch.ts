/*
 Copyright (c) 2020 Xiamen Yaji Software Co., Ltd.

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
 * @hidden
 */

import { MeshBuffer } from '../../../ui';
import { Material } from '../../assets/material';
import { Texture, Sampler, Device, Buffer, BufferInfo, BufferUsageBit, MemoryUsageBit, DescriptorSet } from '../../gfx';
import { Node } from '../../scene-graph';
import { Camera } from '../scene/camera';
import { Model } from '../scene/model';
import { UI } from './ui';
import { NULL_HANDLE, UIBatchHandle, UIBatchPool, UIBatchView, PassPool, PassView } from '../core/memory-pools';
import { Layers } from '../../scene-graph/layers';
import { Pass } from '../core/pass';
import { legacyCC } from '../../global-exports';
import { UBOLocal } from '../../pipeline/define';

const UI_VIS_FLAG = Layers.Enum.NONE | Layers.Enum.UI_3D;

export class UIDrawBatch {
    public get handle () {
        return this._handle;
    }
    public get hInputAssembler () {
        return UIBatchPool.get(this._handle, UIBatchView.INPUT_ASSEMBLER);
    }
    public set hInputAssembler (handle) {
        UIBatchPool.set(this._handle, UIBatchView.INPUT_ASSEMBLER, handle);
    }
    public get hDescriptorSet () {
        return UIBatchPool.get(this._handle, UIBatchView.DESCRIPTOR_SET);
    }
    public set hDescriptorSet (handle) {
        UIBatchPool.set(this._handle, UIBatchView.DESCRIPTOR_SET, handle);
    }
    public get visFlags () {
        return UIBatchPool.get(this._handle, UIBatchView.VIS_FLAGS);
    }
    public set visFlags (vis) {
        UIBatchPool.set(this._handle, UIBatchView.VIS_FLAGS, vis);
    }
    public get passes () {
        return this._passes;
    }

    public get localBuffer () {
        if (!this.useLocalData) { return null; }
        if (!this._localBuffer) {
            this._localBuffer = this._device.createBuffer(new BufferInfo(
                BufferUsageBit.UNIFORM | BufferUsageBit.TRANSFER_DST,
                MemoryUsageBit.HOST | MemoryUsageBit.DEVICE,
                UBOLocal.SIZE,
                UBOLocal.SIZE,
            ));
        }
        return this._localBuffer;
    }

    public bufferBatch: MeshBuffer | null = null;
    public camera: Camera | null = null;
    public model: Model | null = null;
    public texture: Texture | null = null;
    public sampler: Sampler | null = null;
    public useLocalData: Node | null = null;
    public isStatic = false;
    public textureHash = 0;
    public samplerHash = 0;
    private _handle: UIBatchHandle = NULL_HANDLE;
    private _passes: Pass[] = [];

    private _device: Device;
    private _localBuffer: Buffer | null = null;

    constructor () {
        this._handle = UIBatchPool.alloc();
        UIBatchPool.set(this._handle, UIBatchView.VIS_FLAGS, UI_VIS_FLAG);
        UIBatchPool.set(this._handle, UIBatchView.INPUT_ASSEMBLER, NULL_HANDLE);
        UIBatchPool.set(this._handle, UIBatchView.DESCRIPTOR_SET, NULL_HANDLE);
        this._device = legacyCC.director.root.device;
    }

    public destroy (ui: UI) {
        if (this._handle) {
            UIBatchPool.free(this._handle);
            this._handle = NULL_HANDLE;
        }
    }

    public clear () {
        this.bufferBatch = null;
        this.hInputAssembler = NULL_HANDLE;
        this.hDescriptorSet = NULL_HANDLE;
        this.camera = null;
        this.texture = null;
        this.sampler = null;
        this.model = null;
        this.isStatic = false;
        this.useLocalData = null;
        this.visFlags = UI_VIS_FLAG;
        this._passes = [];
    }

    // handle version
    // public fillPasses (mat: Material | null, dssHandle, bsHandle) {
    //     if (mat) {
    //         const passes = mat.passes;
    //         if (!passes) { return; }

    //         UIBatchPool.set(this._handle, UIBatchView.PASS_COUNT, passes.length);
    //         let passOffset = UIBatchView.PASS_0 as const;
    //         let shaderOffset = UIBatchView.SHADER_0 as const;
    //         for (let i = 0; i < passes.length; i++, passOffset++, shaderOffset++) {
    //             const pass = passes[i];
    //             const hMtlPass = pass.handle;
    //             let hPass = UIBatchPool.get(this._handle, passOffset);
    //             if (hPass === NULL_HANDLE) { hPass = PassPool.alloc(); }

    //             PassPool.set(hPass, PassView.PRIORITY, PassPool.get(hMtlPass, PassView.PRIORITY));
    //             PassPool.set(hPass, PassView.STAGE, PassPool.get(hMtlPass, PassView.STAGE));
    //             PassPool.set(hPass, PassView.PHASE, PassPool.get(hMtlPass, PassView.PHASE));
    //             PassPool.set(hPass, PassView.BATCHING_SCHEME, PassPool.get(hMtlPass, PassView.BATCHING_SCHEME));
    //             PassPool.set(hPass, PassView.PRIMITIVE, PassPool.get(hMtlPass, PassView.PRIMITIVE));
    //             PassPool.set(hPass, PassView.DYNAMIC_STATES, PassPool.get(hMtlPass, PassView.DYNAMIC_STATES));
    //             PassPool.set(hPass, PassView.HASH, PassPool.get(hMtlPass, PassView.HASH));
    //             PassPool.set(hPass, PassView.RASTERIZER_STATE, PassPool.get(hMtlPass, PassView.RASTERIZER_STATE));
    //             PassPool.set(hPass, PassView.DESCRIPTOR_SET, PassPool.get(hMtlPass, PassView.DESCRIPTOR_SET));
    //             PassPool.set(hPass, PassView.PIPELINE_LAYOUT, PassPool.get(hMtlPass, PassView.PIPELINE_LAYOUT));

    //             if (dssHandle === NULL_HANDLE) { dssHandle = pass.depthStencilState.handle; }
    //             PassPool.set(hPass, PassView.DEPTH_STENCIL_STATE, dssHandle);
    //             if (bsHandle === NULL_HANDLE) { bsHandle = pass.blendState.handle; }
    //             PassPool.set(hPass, PassView.BLEND_STATE, bsHandle);

    //             UIBatchPool.set(this._handle, passOffset, hPass);
    //             UIBatchPool.set(this._handle, shaderOffset, pass.getShaderVariant());
    //         }
    //     }
    // }

    // object version
    public fillPasses (mat: Material | null, dss, bs) {
        if (mat) {
            const passes = mat.passes;
            if (!passes) { return; }

            UIBatchPool.set(this._handle, UIBatchView.PASS_COUNT, passes.length);
            let passOffset = UIBatchView.PASS_0 as const;
            let shaderOffset = UIBatchView.SHADER_0 as const;
            for (let i = 0; i < passes.length; i++, passOffset++, shaderOffset++) {
                if (!this._passes[i]) {
                    this._passes[i] = new Pass(legacyCC.director.root);
                    // @ts-expect-error hack for UI use pass object
                    this._passes[i]._handle = PassPool.alloc();
                }
                const mtlPass = passes[i];
                const passInUse = this._passes[i];
                if (!dss) { dss = mtlPass.depthStencilState; }
                if (!bs) { bs = mtlPass.blendState; }

                mtlPass.update();
                // @ts-expect-error hack for UI use pass object
                passInUse._initPassFromTarget(mtlPass, dss, bs);
                UIBatchPool.set(this._handle, passOffset, passInUse.handle);
                UIBatchPool.set(this._handle, shaderOffset, passInUse.getShaderVariant());
            }
        }
    }

    public bindLocalBuffer () {
        if (this.useLocalData) {
            if (!this._localBuffer) {
                this._localBuffer = this._device.createBuffer(new BufferInfo(
                    BufferUsageBit.UNIFORM | BufferUsageBit.TRANSFER_DST,
                    MemoryUsageBit.HOST | MemoryUsageBit.DEVICE,
                    UBOLocal.SIZE,
                    UBOLocal.SIZE,
                ));
            }
        }
    }
}
