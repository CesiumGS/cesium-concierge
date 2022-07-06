"use strict";
const url = require("url");

const Promise = require("bluebird");
const requestPromise = require("request-promise");

const loadRepoConfig = require("../../lib/loadRepoConfig");

describe("loadRepoConfig", function () {
  const configUrl = "https://config.url/";
  const initialConfig = {
    option: 1,
    option2: 2,
  };

  const notFoundResponse = {
    statusCode: 404,
  };

  const unexpectedErrorRespomse = {
    statusCode: 201,
  };

  const configFileUrl = url.URL(configUrl, loadRepoConfig._configFile);
  const sampleConfig = {
    option: "myValue",
    optionList: [1, 2, 3],
  };
  const configFileResponseJson = {
    name: loadRepoConfig.configFile,
    content: Buffer.from(JSON.stringify(sampleConfig)).toString("base64"),
  };

  const templatesUrl = url.URL(configUrl, loadRepoConfig._templateDirectory);
  const templatesResponseJson = [
    {
      name: "signature.hbs",
      url: "//file.url",
    },
    {
      name: "issueClosed.hbs",
      url: "//file.url",
    },
    {
      name: "another.json",
      url: "//file.url",
    },
  ];

  const templateUrl = "https://config.url/templates/";
  const templateContents = "Here is a template.";
  const templateFileResponseJson = {
    name: "signature.hbs",
    content: Buffer.from(templateContents, "ascii").toString("base64"),
    encoding: "base64",
  };

  it("populates configuration option based on supplied config file and template directory", function (done) {
    spyOn(loadRepoConfig, "_getConfig").and.callFake(function () {
      return Promise.resolve({});
    });
    spyOn(loadRepoConfig, "_getTemplates").and.callFake(function () {
      return Promise.resolve({});
    });

    loadRepoConfig("Org/repo-name", {}, {}).then(function () {
      const expectedUrl = url.URL(
        "https://api.github.com/repos/Org/repo-name/contents/",
        loadRepoConfig._configDirectory
      );

      expect(loadRepoConfig._getConfig).toHaveBeenCalledWith(
        expectedUrl,
        {},
        {}
      );
      expect(loadRepoConfig._getTemplates).toHaveBeenCalledWith(
        expectedUrl,
        {},
        {}
      );

      done();
    });
  });

  describe("_getConfig", function () {
    it("requests the expected url", function (done) {
      spyOn(requestPromise, "get").and.callFake(function (options) {
        if (options.url === configFileUrl) {
          return Promise.resolve(configFileResponseJson);
        }

        return Promise.reject();
      });

      loadRepoConfig
        ._getConfig(configUrl, {}, initialConfig)
        .then(done)
        .catch(done.fail);
    });

    it("sets configuration for each property in config file", function (done) {
      const sampleHeaders = {};

      spyOn(requestPromise, "get").and.callFake(function () {
        return Promise.resolve(configFileResponseJson);
      });

      loadRepoConfig
        ._getConfig(configUrl, sampleHeaders, initialConfig)
        .then(function (config) {
          expect(config.option).toEqual(sampleConfig.option);
          expect(config.option2).toEqual(initialConfig.option2);
          expect(config.optionList).toEqual(sampleConfig.optionList);
          done();
        })
        .catch(done.fail);
    });

    it("returns default configuration if there is no template directory", function (done) {
      spyOn(requestPromise, "get").and.callFake(function () {
        return Promise.reject(notFoundResponse);
      });

      loadRepoConfig
        ._getConfig(configUrl, {}, initialConfig)
        .then(function (config) {
          expect(config).toEqual(initialConfig);
          done();
        })
        .catch(done.fail);
    });

    it("rejects on unexpected error", function (done) {
      spyOn(requestPromise, "get").and.callFake(function () {
        return Promise.reject(unexpectedErrorRespomse);
      });

      loadRepoConfig
        ._getConfig(configUrl, {}, initialConfig)
        .then(function () {
          done.fail();
        })
        .catch(done);
    });
  });

  describe("_getTemplates", function () {
    it("requests the expected url", function (done) {
      spyOn(requestPromise, "get").and.callFake(function (options) {
        if (options.url === templatesUrl) {
          return Promise.resolve([]);
        }

        return Promise.reject();
      });

      loadRepoConfig
        ._getTemplates(configUrl, {}, initialConfig)
        .then(done)
        .catch(done.fail);
    });

    it("sets template content for each .hbr file", function (done) {
      const sampleHeaders = {};

      spyOn(requestPromise, "get").and.callFake(function () {
        return Promise.resolve(templatesResponseJson);
      });

      spyOn(loadRepoConfig, "_getTemplate").and.callFake(function (
        url,
        headers
      ) {
        expect(url).toBeDefined();
        expect(headers).toBe(sampleHeaders);
        return Promise.resolve("A template");
      });

      loadRepoConfig
        ._getTemplates(configUrl, sampleHeaders, initialConfig)
        .then(function (config) {
          expect(config.option).toEqual(initialConfig.option);
          expect(config.option2).toEqual(initialConfig.option2);
          expect(config.signatureTemplate).toEqual("A template");
          expect(config.issueClosedTemplate).toEqual("A template");
          expect(config.anotherTemplate).toBeUndefined();
          done();
        })
        .catch(done.fail);
    });

    it("returns default configuration if there is no template directory", function (done) {
      spyOn(requestPromise, "get").and.callFake(function () {
        return Promise.reject(notFoundResponse);
      });

      loadRepoConfig
        ._getTemplates(configUrl, {}, initialConfig)
        .then(function (config) {
          expect(config).toEqual(initialConfig);
          done();
        })
        .catch(done.fail);
    });

    it("rejects on unexpected error", function (done) {
      spyOn(requestPromise, "get").and.callFake(function () {
        return Promise.reject(unexpectedErrorRespomse);
      });

      loadRepoConfig
        ._getTemplates(configUrl, {}, initialConfig)
        .then(function () {
          done.fail();
        })
        .catch(done);
    });
  });

  it("_getTemplate requests and returns the content of a template file", function (done) {
    spyOn(requestPromise, "get").and.callFake(function (options) {
      if (options.url === templateUrl) {
        return Promise.resolve(templateFileResponseJson);
      }

      return Promise.reject();
    });

    loadRepoConfig
      ._getTemplate(templateUrl, {})
      .then(function (content) {
        expect(content).toEqual(templateContents);
        done();
      })
      .catch(done.fail);
  });
});
