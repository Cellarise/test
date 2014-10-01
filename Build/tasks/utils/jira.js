/* jslint node: true */
"use strict";

var rest = require('oauth-rest-atlassian').rest;
var _ = require('underscore');
var config = require('./config')('jira');

/**
 * JIRA build utilities
 * @exports utils/jira
 * @returns {Object}
 */
module.exports = function()  {
    return {
        /**
         * Get all JIRA projects.
         * @param cb {Function} - callback function with signature: function(err, data)
         */
        getProjects: function (cb) {
            rest({
                config: config,
                query: "project"
            }, cb);
        },

        /**
         * Create a JIRA issue.
         * @param issue {Object} - object map with properties required to create the issue
         * @param {String} issue.key - key for the JIRA project to create the issue within
         * @param {String} issue.summary - the summary description for the issue
         * @param {String} issue.issueType - the name of the issue type
         * @param {String} issue.version - the release version for the issue (fixversion)
         * @param cb {Function} - callback function with signature: function(err, data)
         */
        createIssue: function (issue, cb) {
            //create update task in JIRA (non-func issue type) and get issue key
            rest({
                config: config,
                query: "issue",
                method: 'post',
                postData: {
                    fields: {
                        project: {
                            key: issue.key
                        },
                        summary: issue.summary,
                        issuetype: {
                            name: issue.issueType
                        },
                        fixVersions: [{
                            name: issue.version
                        }]
                    }
                }
            }, cb);
        },

        /**
         * Delete a JIRA issue.
         * @param key {String} - the key for the JIRA issue to delete
         * @param cb {Function} - callback function with signature: function(err, data)
         */
        deleteIssue: function (key, cb) {
            rest({
                config: config,
                query: "issue/" + key,
                method: 'delete'
            }, cb);
        },

        /**
         * Create a new version in a JIRA project.
         * @param key {String} - the JIRA project key
         * @param version {String} - the version (semver)
         * @param cb {Function} - callback function with signature: function(err, data)
         */
        createVersion: function (key, version, cb) {
            rest({
                    config: config,
                    query: "version",
                    method: 'post',
                    postData: {
                        project: key,
                        name: version
                    }
                },
                function(err, data){
                    cb(err, data);
                });
        },

        /**
         * Transition a JIRA issue.
         * @param key {String} - key for the JIRA issue to transition
         * @param transition {String} - the transition id
         * @param cb {Function} - callback function with signature: function(err, data)
         */
        transitionIssue: function (key, transition, cb) {
            rest({
                config: config,
                query: "issue/" + key + "/transitions",
                method: 'post',
                postData: {
                    /*update: {
                     comment: [
                     {
                     add: {
                     body: "Auto-update"
                     }
                     }
                     ]
                     },*/
                    transition: {
                        id: transition
                    }
                }
            }, cb);
        },

        /**
         * Get the next unresolved and unreleased minor version for the project (based on semver).
         * If there is an existing unresolved and unreleased major or minor version then the earliest is returned.
         * @param key {String} - the JIRA project key
         * @param cb {Function} - callback function with signature: function(err, data)
         */
        getNextUnreleasedPatchVersion: function (key, cb) {
            var self = this;
            rest({
                config: config,
                query: "project/" + key + "/versions"
            }, function(err, versions){
                var lastReleasedVersion = '0.0.0';
                var nextUnreleasedPatchVersion = null;
                if(!err){
                    if(versions.length > 0){
                        //sort in semver order (assumes name of version is in semver format)
                        versions = _.sortBy(versions, function(version){
                            var versionArray = version.name.split('.');
                            version =
                                (parseInt(versionArray[0], 10) * 1000000) +
                                (parseInt(versionArray[1], 10) * 1000) +
                                (parseInt(versionArray[2], 10));
                            return version;
                        });

                        //get released versions
                        var releasedVersions = _.filter(versions, function(version){
                            return version.released && !version.archived;
                        });
                        //get latest released version
                        if(releasedVersions.length > 0){
                            lastReleasedVersion = releasedVersions[releasedVersions.length -1].name;
                        }

                        //get unreleased versions
                        var unreleasedVersions = _.filter(versions, function(version){
                            return !version.released && !version.archived;
                        });
                        //get earliest patch version
                        if(unreleasedVersions.length > 0 &&
                            parseInt(unreleasedVersions[0].name.split('.')[2], 10) > 0){
                            nextUnreleasedPatchVersion = versions[0].name;
                        }
                    }

                    if(nextUnreleasedPatchVersion === null){
                        //create new patch version
                        var lastReleasedVersionArray = lastReleasedVersion.split('.');
                        nextUnreleasedPatchVersion =
                            lastReleasedVersionArray[0] + '.' +
                            lastReleasedVersionArray[1] + '.' +
                                (parseInt(lastReleasedVersionArray[2], 10) + 1);

                        self.createVersion(key, nextUnreleasedPatchVersion, function(err2, version){
                            nextUnreleasedPatchVersion = null;
                            if(!err2){
                                nextUnreleasedPatchVersion = version.name;
                            }
                            cb(err2, nextUnreleasedPatchVersion);
                        });
                    } else {
                        cb(err, nextUnreleasedPatchVersion);
                    }
                } else {
                    cb(err, nextUnreleasedPatchVersion);
                }
            });
        },

        /**
         * Get the changelog for a JIRA project.
         * @param key {String} - the JIRA project key
         * @param cb {Function} - callback function with signature: function(err, data)
         */
        getChangelog: function (key, cb) {
            var self = this;
            var jiraQuery = "search?jql=(project = " + key + " AND " +
                "issuetype in standardIssueTypes() AND issuetype != Task AND " +
                "resolution != Unresolved AND " +
                "fixVersion in (unreleasedVersions(), releasedVersions())) ORDER BY fixVersion DESC, resolutiondate DESC";
            var queryFields = "&fields=Key,summary,issuetype,status,fixVersions,priority,components,resolution,resolutiondate";
            rest({
                config: config,
                query: jiraQuery + queryFields
            }, function(err, data){
                cb(err, self.prepareChangeLogJSON(data));
            });
        },

        /**
         * Tranform raw changelog data from a JQL query into a JSON object.
         * @param data {Object} - raw changelog data
         * @example
         Raw changelog data:
         ```
         {
         "releases": [
             {
               "version": {
                 "self": "https://jira.cellarise.com/rest/api/2/version/10516",
                 "id": "10516",
                 "name": "0.1.4",
                 "archived": false,
                 "released": true,
                 "releaseDate": "2014-08-28"
               },
               "issues": []
             }
         }
         ```
         */
        prepareChangeLogJSON: function (data) {
            if(!data){
                return {};
            }
            var changeLogJSON = {
                    releases: []
                },
                i,
                issues = data.issues,
                currentIssue,
                currentVersion,
                release,
                releaseNum = -1,
                date = new Date();

            for (i = 0; i < issues.length; i = i + 1) {
                currentIssue = issues[i];
                currentVersion = currentIssue.fields.fixVersions[0];
                //first version or check for change in version
                if (!release || release.name !== currentVersion.name) {
                    //check if version date set, otherwise set to current date
                    if (!currentVersion.releaseDate) {
                        currentVersion.releaseDate = date.getFullYear() + "-" +
                            ("0" + (date.getMonth() + 1)).slice(-2) + "-" +
                            ("0" + date.getDate()).slice(-2);
                    }
                    release = currentVersion;
                    releaseNum = releaseNum + 1;
                    changeLogJSON.releases[releaseNum] = {
                        version: currentVersion,
                        issues: []
                    };
                }
                //add issue to release
                changeLogJSON.releases[releaseNum].issues.push({
                    key: currentIssue.key,
                    summary: currentIssue.fields.summary,
                    issuetype: currentIssue.fields.issuetype,
                    status: currentIssue.fields.status,
                    priority: currentIssue.fields.priority,
                    resolution: currentIssue.fields.resolution,
                    components: currentIssue.fields.components,
                    resolutiondate: currentIssue.fields.resolutiondate
                });
            }
            return changeLogJSON;
        }
    };

};

