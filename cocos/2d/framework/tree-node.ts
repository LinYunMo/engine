import { Component } from "../../core";
import { NodeEventType } from "../../core/scene-graph/node-event";
import { RenderGroupInfo } from "./render-group-2d";

const globalEmptyRenderGroupInfo = new RenderGroupInfo();
export class TreeNode2D extends Component {
    public parent: TreeNode2D | null = null;
    public children: TreeNode2D[] = [];
    public opacity: number = 0;
    public root: RenderGroupInfo = globalEmptyRenderGroupInfo;
    private _priority: number = 0;

    public set priority (val: number) {
        if (this._priority !== val) {
            this._priority = val;
        }
    }

    protected checkOrAddParentTreeNode () {
        let parent = this.node.parent;
        if (!parent) return;
        let parentTreeNode = parent.getComponent(TreeNode2D);
        if (!parentTreeNode) {
            parentTreeNode = parent.addComponent(TreeNode2D);
        }
        this.parent = parentTreeNode;
        this.parent.children.push(this);
    }

    onLoad () {
        this.checkOrAddParentTreeNode();
    }

    onEnable () {
        this.node.on(NodeEventType.SIBLING_ORDER_CHANGED, this.onSiblingChanged, this);
        this.node.on(NodeEventType.PARENT_CHANGED, this.onParentChanged, this);
    }

    onDisable () {
        this.node.off(NodeEventType.SIBLING_ORDER_CHANGED, this.onSiblingChanged, this);
        this.node.off(NodeEventType.PARENT_CHANGED, this.onParentChanged, this);
    }

    onSiblingChanged () {
        if (this.parent) { this.parent.orderDirty = true; }
    }

    onParentChanged () {
        if (this.parent) {
            const removeAt = this.parent.children.indexOf(this);
            this.parent.children.splice(removeAt, 1);
        }
        this.parent = null;
        this.checkOrAddParentTreeNode();
    }
}