/*
 * Copyright ©️ 2018 Galt•Space Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka),
 * [Dima Starodubcev](https://github.com/xhipster),
 * [Valery Litvin](https://github.com/litvintech) by
 * [Basic Agreement](http://cyb.ai/QmSAWEG5u5aSsUyMNYuX2A2Eaz4kEuoYWUkVBRdmu9qmct:ipfs)).
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) and
 * Galt•Space Society Construction and Terraforming Company by
 * [Basic Agreement](http://cyb.ai/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS:ipfs)).
 */

import {IDatabase, GroupType, GroupView, ContentType, PostStatus, ContentView, IPost} from "../../database/interface";
import {IGeesomeApp} from "../interface";
import {IStorage} from "../../storage/interface";
import {IRender} from "../../render/interface";

const commonHelper = require('../../../libs/common');
const config = require('./config');
const _ = require('lodash');

module.exports = async () => {
    const app = new GeesomeApp(config);

    console.log('Start storage...');
    app.storage = await require('../../storage/' + config.storageModule)(app);
    
    console.log('Start database...');
    app.database = await require('../../database/' + config.databaseModule)(app);

    app.render = await require('../../render/' + config.renderModule)(app);
    
    app.previewManager = await require('./previewManager')(app);
    
    if((await app.database.getUsersCount()) === 0) {
        console.log('Run seeds...');
        await app.runSeeds();
    }
    
    
    app.authorization = await require('../../authorization/' + config.authorizationModule)(app);

    console.log('Start api...');
    require('../../api/' + config.apiModule)(app, 7711);
    
    return app;
};

class GeesomeApp implements IGeesomeApp {
    database: IDatabase;
    storage: IStorage;
    render: IRender;
    authorization: any;
    previewManager: any;
    
    constructor(
        public config
    ) {
    }
    
    async checkGroupId(groupId) {
        if(!commonHelper.isNumber(groupId)) {
            const group = await this.database.getGroupByManifestId(groupId);
            if(!group) {
                return false;
            }
            groupId = group.id;
        }
        return groupId;
    }
    
    async canCreatePostInGroup(userId, groupId) {
        if(!groupId) {
            return false;
        }
        groupId = await this.checkGroupId(groupId);
        return this.database.isAdminInGroup(userId, groupId);
    }

    async createGroup(userId, groupData) {
        groupData.userId = userId;
        groupData.storageAccountId = await this.storage.createAccountIfNotExists(groupData['name']);
        groupData.manifestStaticStorageId = groupData.storageAccountId;

        const group = await this.database.addGroup(groupData);

        await this.updateGroupManifest(group.id);

        return this.database.getGroup(group.id);
    }

    async updateGroup(groupId, updateData) {
        await this.database.updateGroup(groupId, updateData);

        await this.updateGroupManifest(groupId);

        return this.database.getGroup(groupId);
    }

    async createPost(userId, postData) {
        postData.userId = userId;
        postData.groupId = await this.checkGroupId(postData.groupId);

        if(postData.status === PostStatus.Published) {
            postData.localId = await this.getPostLocalId(postData);
            postData.publishedAt = new Date();
        }
        
        const contentsIds = postData.contentsIds;
        delete postData.contentsIds;
        
        const post = await this.database.addPost(postData);

        await this.database.setPostContents(post.id, contentsIds);
        await this.updatePostManifest(post.id);

        console.log('this.database.getPost')
        return this.database.getPost(post.id);
    }

    async updatePost(userId, postId, postData) {
        const contentsIds = postData.contentsIds;
        delete postData.contentsIds;
        
        const oldPost = await this.database.getPost(postId);
        
        if(postData.status === PostStatus.Published && !oldPost.localId) {
            postData.localId = await this.getPostLocalId(postData);
        }

        await this.database.setPostContents(postId, contentsIds);

        await this.database.updatePost(postId, postData);
        await this.updatePostManifest(postId);
        
        return this.database.getPost(postId);
    }
    
    async getPostLocalId(post: IPost) {
        if(!post.groupId) {
            return null;
        }
        const group = await this.database.getGroup(post.groupId);
        group.publishedPostsCount++;
        await this.database.updateGroup(group.id, {publishedPostsCount: group.publishedPostsCount});
        return group.publishedPostsCount;
    }

    async saveData(fileStream, fileName, options) {
        const storageFile = await this.storage.saveFileByData(fileStream);
        
        const existsContent = await this.database.getContentByStorageId(storageFile.id);
        if(existsContent) {
            return existsContent;
        }
        
        const groupId = await this.checkGroupId(options.groupId);
        const group = await this.database.getGroup(groupId);

        const type = this.detectType(storageFile.id, fileName);
        let previewStorageId;
        let previewType;
        if(!options.preview) {
            previewStorageId = await this.previewManager.getPreviewStorageId(storageFile.id, type, {userId: options.userId, groupId});
            previewType = type;
        }
        
        const content = await this.database.addContent({
            groupId,
            type,
            previewStorageId,
            previewType,
            userId: options.userId,
            view: ContentView.List,
            storageId: storageFile.id,
            size: storageFile.size,
            name: fileName,
            isPublic: group.isPublic
        });
        await this.updateContentManifest(content.id);
        
        return content;
    }

    async saveDataByUrl(url, userId, groupId) {
        const storageFile = await this.storage.saveFileByUrl(url);

        const existsContent = await this.database.getContentByStorageId(storageFile.id);
        if(existsContent) {
            return existsContent;
        }
        
        groupId = await this.checkGroupId(groupId);
        const group = await this.database.getGroup(groupId);
        const name = _.last(url.split('/'));
        const type = this.detectType(storageFile.id, name);
        const previewStorageId = await this.previewManager.getPreviewStorageId(storageFile.id, type, {userId, groupId});

        const content = await this.database.addContent({
            userId,
            groupId,
            previewStorageId,
            type,
            previewType: type,
            view: ContentView.List,
            storageId: storageFile.id,
            size: storageFile.size,
            name: name,
            isPublic: group.isPublic
        });
        await this.updateContentManifest(content.id);

        return content;
    }
    
    async updatePostManifest(postId) {
        const post = await this.database.getPost(postId);
        
        await this.database.updatePost(postId, {
            manifestStorageId: await this.generateAndSaveManifest('post', post)
        });
        
        return this.updateGroupManifest(post.groupId);
    }

    async updateGroupManifest(groupId) {
        const group = await this.database.getGroup(groupId);
        
        const manifestStorageId = await this.generateAndSaveManifest('group', group);

        console.log('bindToStaticId', manifestStorageId, group.manifestStaticStorageId);
        await this.storage.bindToStaticId(manifestStorageId, group.manifestStaticStorageId);
        console.log('updateGroup', groupId);
        
        return this.database.updateGroup(groupId, {
            manifestStorageId
        });
    }

    async updateContentManifest(contentId) {
        return this.database.updateContent(contentId, {
            manifestStorageId: await this.generateAndSaveManifest('content', await this.database.getContent(contentId))
        });
    }
    
    private detectType(storageId, fileName) {
        const ext = _.last(fileName.split('.')).toLowerCase();

        let type: any = ContentType.Unknown;
        if(_.includes(['jpg', 'jpeg', 'png', 'gif'], ext)) {
            type = 'image/' + ext;
        }
        if(_.includes(['html', 'htm'], ext)) {
            type = 'text/' + ext;
        }
        if(_.includes(['md'], ext)) {
            type = 'text/' + ext;
        }
        if(_.includes(['txt'], ext)) {
            type = 'text';
        }
        return type;
    }
    
    private async generateAndSaveManifest(entityName, entityObj) {
        const manifestContent = await this.render.generateContent(entityName + '-manifest', entityObj);
        console.log(JSON.stringify(manifestContent, null, ' '));
        return this.storage.saveObject(manifestContent);
    }
    
    getFileStream(filePath) {
        return this.storage.getFileStream(filePath)
    }

    getMemberInGroups(userId) {
        return this.database.getMemberInGroups(userId)
    }

    getAdminInGroups(userId) {
        return this.database.getAdminInGroups(userId)
    }

    getGroup(groupId) {
        return this.database.getGroup(groupId);
    }

    getGroupByManifestId(groupId) {
        return this.database.getGroupByManifestId(groupId);
    }

    getGroupPosts(groupId, sortDir, limit, offset) {
        return this.database.getGroupPosts(groupId, sortDir, limit, offset)
    }

    getContent(contentId) {
        return this.database.getContent(contentId);
    }

    getDataStructure(dataId) {
        return this.storage.getObject(dataId);
    }

    runSeeds() {
        return require('./seeds')(this);
    }
}
