/**
 * 遊戲共用對話與選擇系統引擎 (Dialogue System Engine)
 */
class GameDialogueSystem {
    constructor(config) {
        this.scenario = config.scenario;
        this.currentNodeKey = config.initialNode || "node_1";
        this.isTyping = false;
        this.typeTimer = null;
        this.currentFullText = "";
        this.onNodeChange = config.onNodeChange || (() => {});
        this.onFinish = config.onFinish || (() => {});

        // 追蹤哪些選項（以 target 作為識別）已經被點擊過
        this.clickedOptions = new Set();

        // DOM 元素快取
        this.dialogueBox = document.getElementById(config.dialogueBoxId || 'dialogueBox');
        this.speakerName = document.getElementById(config.speakerNameId || 'speakerName');
        this.dialogueText = document.getElementById(config.dialogueTextId || 'dialogueText');
        this.choicesContainer = document.getElementById(config.choicesContainerId || 'choicesContainer');
        this.nextIndicator = document.getElementById(config.nextIndicatorId || 'nextIndicator');
        
        // 音效函數
        this.playTypeSound = config.playTypeSound || (() => {});
        this.playClickSound = config.playClickSound || (() => {});
    }

    renderNode(nodeKey) {
        this.currentNodeKey = nodeKey;
        const node = this.scenario[nodeKey];
        if (!node) return;

        // 回調通知外部（例如 Chapter1 的 spread 切換或 Chapter0 的分數加減）
        this.onNodeChange(nodeKey, node);

        if (this.choicesContainer) this.choicesContainer.innerHTML = "";
        if (this.dialogueBox) this.dialogueBox.classList.remove('hide-fade');
        
        if (this.speakerName) this.speakerName.innerText = node.speaker || "";
        this.startTypewriter(node.text || "");
    }

    startTypewriter(text) {
        this.isTyping = true;
        this.currentFullText = text;
        if (this.dialogueText) this.dialogueText.innerText = "";
        if (this.nextIndicator) this.nextIndicator.style.display = "none";
        
        let index = 0;
        clearInterval(this.typeTimer);

        this.typeTimer = setInterval(() => {
            if (index < text.length) {
                if (this.dialogueText) this.dialogueText.innerText += text.charAt(index);
                this.playTypeSound();
                index++;
            } else {
                this.completeTypewriter();
            }
        }, 35);
    }

    completeTypewriter() {
        clearInterval(this.typeTimer);
        if (this.dialogueText) this.dialogueText.innerText = this.currentFullText;
        this.isTyping = false;
        
        const node = this.scenario[this.currentNodeKey];
        if (node && node.options && node.options.length > 0) {
            this.renderOptions(node.options);
            if (this.nextIndicator) this.nextIndicator.style.display = "none";
        } else {
            if (this.nextIndicator) {
                this.nextIndicator.innerText = "▼";
                this.nextIndicator.classList.add('blink');
                this.nextIndicator.style.display = "block";
            }
        }
    }

    renderOptions(options) {
        if (!this.choicesContainer) return;
        this.choicesContainer.innerHTML = "";
        
        const currentNode = this.scenario[this.currentNodeKey];
        
        options.forEach((opt, idx) => {
            const btn = document.createElement('div');
            btn.className = 'choice-btn';
            btn.innerText = opt.text;
            btn.style.animationDelay = `${idx * 0.12}s`;

            if (this.clickedOptions.has(opt.target)) {
                btn.classList.add('disabled');
            } else {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    this.playClickSound();

                    // 1. 記錄此選項目標已被點擊過
                    this.clickedOptions.add(opt.target);

                    const allBtns = this.choicesContainer.querySelectorAll('.choice-btn');
                    allBtns.forEach(b => b.style.pointerEvents = 'none');

                    btn.classList.add('falling');
                    allBtns.forEach(otherBtn => {
                        if (otherBtn !== btn) otherBtn.classList.add('fade-out');
                    });

                    setTimeout(() => {
                        this.choicesContainer.innerHTML = "";
                        
                        // 檢查是不是所有選項都點過了
                        const allTargets = options.map(o => o.target);
                        const finishedAll = allTargets.every(target => this.clickedOptions.has(target));

                        if (currentNode.requireAll && !finishedAll) {
                            // 還沒點完：強制看完支線後返回原選擇點 (node_3)
                            this.renderNodeWithReturn(opt.target, this.currentNodeKey);
                        } else {
                            // 已經全部點完了，或是普通選項：正常前往目標
                            // 如果是 requireAll 的最後一個選項，我們確保它打完後能去 node_5
                            if (currentNode.requireAll && finishedAll) {
                                // 暫時把該目標節點的 next 指向 node_5（確保後續推進順暢）
                                if (this.scenario[opt.target]) {
                                    this.scenario[opt.target].next = "node_4B"; // 讓它先去合流點 node_4B
                                }
                            }
                            this.renderNode(opt.target);
                        }
                    }, 700);
                };
            }

            this.choicesContainer.appendChild(btn);
        });
    }

    // 輔助方法 1：看完支線後自動返回原本的選擇點
    renderNodeWithReturn(branchTarget, returnKey) {
        this.currentNodeKey = branchTarget;
        const node = this.scenario[branchTarget];
        if (!node) return;

        this.onNodeChange(branchTarget, node);
        if (this.choicesContainer) this.choicesContainer.innerHTML = "";
        if (this.dialogueBox) this.dialogueBox.classList.remove('hide-fade');
        if (this.speakerName) this.speakerName.innerText = node.speaker || "";

        // 強制將這個支線的下一步導回原本的選擇畫面
        node.next = returnKey; 

        this.startTypewriter(node.text || "");
    }

    // 輔助方法 2：處理最後一個選項，跑完後前往最終目的地
    renderNodeAndThenProceed(branchTarget, finalTarget) {
        this.currentNodeKey = branchTarget;
        const node = this.scenario[branchTarget];
        if (!node) return;

        this.onNodeChange(branchTarget, node);
        if (this.choicesContainer) this.choicesContainer.innerHTML = "";
        if (this.dialogueBox) this.dialogueBox.classList.remove('hide-fade');
        if (this.speakerName) this.speakerName.innerText = node.speaker || "";

        // 強制將最後一個支線的結束點指向 node_5
        node.next = finalTarget;

        this.startTypewriter(node.text || "");
    }

    handleDialogueClick() {
        if (this.isTyping) {
            this.completeTypewriter();
            return true;
        }

        const node = this.scenario[this.currentNodeKey];
        
        // 【修改這裡】加上 ?. 選擇運算符號，確保 node.options 存在時才去讀取 length
        if (node && node.options && node.options.length > 0) return true;

        if (node && node.next) {
            this.renderNode(node.next);
            return true;
        } else {
            this.playClickSound();
            if (this.nextIndicator) this.nextIndicator.style.display = "none";
            if (this.dialogueBox) this.dialogueBox.classList.add('hide-fade');
            this.onFinish(this.currentNodeKey);
            return true;
        }
    }
}