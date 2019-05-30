/* require fontawesome
*/

/*
Example:
<editable-span :content="content" @change="content=$event"/>
*/
Vue.component('editable-span', {
    template: `<div>
    <template v-if="!editMode">
        <span @dblclick="editContent" v-text="content"></span>
        <i class="fa fa-edit" @click="editContent"></i>
    </template>
    <div v-show="editMode">
        <input ref="ipt" v-model="newContent" @keyup.enter="saveContent"/>
        <i @click="saveContent" class="fa fa-save"></i>
        <i class="fa fa-undo" @click="editMode=false"></i>
    </div>
    </div>
    `,
    props: ['content'],
    data: function () {
        return {
            editMode: false,
            newContent: "",
        }
    },
    methods: {
        editContent: function () {
            this.newContent = this.content;
            this.editMode = true;
            this.$nextTick(function () {
                this.$refs.ipt.focus()
            }.bind(this))
        },
        saveContent: function () {
            this.editMode = false;
            this.$emit("change", this.newContent);
        }
    }
})