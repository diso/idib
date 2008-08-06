#!/usr/bin/python

LICENSE = """
 Copyright 2008 Vidoop LLC
 
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 
    http://www.apache.org/licenses/LICENSE-2.0
 
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
"""

__copyright__ = 'Copyright 2008, Vidoop LLC'


################################################################################
# Tool for setting the version and server from the install.rdf and 
# uploading # package to a production or unstable server
# version.txt contains version information for plugin
################################################################################

import zipfile
import optparse
import shutil
import xml.dom.minidom
import os
import commands
import sys

################################################################################
# Files that are included in the exported plugin
################################################################################

MANIFEST=[
"CHANGELOG",
"README",
"LICENSE",
"chrome.manifest",
#"content/",
#"content/images/",
#"defaults/",
#"skin/",
"content/browser.xul",
"content/debug.js",
"content/openid.js",
"content/openid_dialog.js",
"content/switch.js",
"content/switch.xul",
"content/util.js",
"content/widgets.xml",
"content/images/background.gif",
"content/images/globe_icon.png",
"content/images/openid16.png",
"content/images/openid_small.png",
"content/images/openidx16.png",
"defaults/preferences/preferences.js",
"skin/main.css",
"skin/notification.css",
"skin/widgets.css",

# "content/constants.js", DO NOT INCLUDE THIS FILE (it is added automatically)
# "./install.rdf",  DO NOT INCLUDE THIS FILE (it is added automatically)
]

EXPORT_DIR=os.path.join('export')
EXPORT_PKG_DIR=os.path.join(EXPORT_DIR, "package")
EXPORT_PLUGIN=os.path.join(EXPORT_DIR,'openid.xpi')
EXPORT_PLUGIN_SIGNED=os.path.join(EXPORT_DIR,'openid-signed.xpi')
EXPORT_PHP=os.path.join(EXPORT_DIR,'plugin_update.php')
EXPORT_INSTALL_RDF=os.path.join(EXPORT_DIR,'install.rdf')
EXPORT_CONSTANTS=os.path.join(EXPORT_DIR,'constants.js')
XPI_SIGNER_JAR=os.path.join("xpi.jar")
XPI_SIGNER_CERT=os.path.join("vidoop-code-signing.pfx")
XPI_SIGNER_PARAMS="%s password %s %s"%(XPI_SIGNER_CERT, EXPORT_PKG_DIR, EXPORT_PLUGIN_SIGNED) 
XPI_SIGNER_CMD="java -jar %s %s"%(XPI_SIGNER_JAR, XPI_SIGNER_PARAMS)

################################################################################
# Uploading to servers
################################################################################

configSet = {}

configSet['stable'] = {
    'update_php_server_path': '',
    'xpi_server_path': '',
    'debug': False,
}

configSet['debug'] = {
    'update_php_server_path': '',
    'xpi_server_path': '',
    'debug': True,
}

################################################################################
# Command line parameters
################################################################################

optionsParser = optparse.OptionParser()
optionsParser.add_option('-v', '--get-version', dest='getVersion', default=False, action='store_true', help='Get version number of plugin')
optionsParser.add_option('-b', '--bump-version', dest='bumpVersion', default=False, action='store_true', help='Bump minor version of plugin')
optionsParser.add_option('-s', '--set-version', dest='setVersion', default=False, help='Set version number to VERSION', metavar="VERSION")
optionsParser.add_option('--verbose', dest='verbose', default=False, action='store_true', help='Verbose output')
optionsParser.add_option('--username', dest='username', default=False, help='Uses remote user USERNAME on server', metavar="USERNAME")
optionsParser.add_option('-u', '--update', dest='update', default=False, action='store_true', help='Update the plugin on appropriate server')
optionsParser.add_option('-c', '--sign-xpi', dest='signXPI', default=False, action='store_true', help='Sign the plugin using a code-signing cert', metavar="SIGN_XPI")
(options, arguments) = optionsParser.parse_args()

verbose = options.verbose

# Gets the version from version.txt
def getVersion():
    versionFile = open('version.txt', 'r')
    version = versionFile.readline().strip()
    if version == False or version == '':
        print 'Version file has invalid version string'
        sys.exit(1)
    versionFile.close()
    return version

def getDomainName(url):
    return url.split('://')[1].split('/')[0]

def getProtocol(url):
    return url.split('://')[0] + '://';

# Set the version in version.txt
def setVersion(version):
    versionFile = open('version.txt', 'w')
    versionFile.write(version)
    versionFile.write('\n')
    versionFile.close()

# Generates export install.rdf file from install.rdf in current directory
def generateInstallRdf(version, config):
    if len(config['update_php_server_path']) > 0:
        updateUrlString = '<em:updateURL>'+config['update_php_server_path']+'</em:updateURL>';
    else:
        updateUrlString = '';

    content = '''<?xml version="1.0"?>

<RDF xmlns="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
     xmlns:em="http://www.mozilla.org/2004/em-rdf#">

  <Description about="urn:mozilla:install-manifest">
    <em:id>firefox.openid@vidoop.com</em:id>
    <em:version>'''+version+'''</em:version>
    <em:type>2</em:type>
   
    <!-- Target Application this extension can install into, 
         with minimum and maximum supported versions. --> 
    <em:targetApplication>
      <Description>
        <em:id>{ec8030f7-c20a-464f-9b0e-13a3a9e97384}</em:id>
        <em:minVersion>1.5</em:minVersion>
        <em:maxVersion>3.0.*</em:maxVersion>
      </Description>
    </em:targetApplication>
   
    <!-- Front End MetaData -->
    <em:name>Firefox OpenID</em:name>
    <em:description>Makes login into OpenID sites even easier!</em:description>
    <em:creator>Vidoop LLC</em:creator>
    <em:homepageURL>http://labs.vidoop.com/</em:homepageURL>
    <em:iconURL>chrome://openid/content/images/globe_icon.png</em:iconURL>
    '''+updateUrlString+'''
    <!--<em:optionsURL>chrome://openid/content/options.xul</em:optionsURL>-->
  </Description>      
</RDF>
''';

    if not os.path.exists(EXPORT_PKG_DIR):
    	os.makedirs(EXPORT_PKG_DIR)
    saveFile = open(EXPORT_INSTALL_RDF, 'w')
    saveFile.write(content+'\n')
    saveFile.close()

    print 'Generated %s' % EXPORT_INSTALL_RDF

def generateConstants(version,config):

    content = '''
    /*
    %s
    */
    const ADD_ANTI_PHISHING_HEADER = false;
    const PLUGIN_SIGNATURE = 'firefox_openid@vidoop.com';

    //XRDS Service Types
    const XRDS_LOGIN_ENDPOINT = 'http://specs.openid.net/login/1.0/';
    const XRDS_USER_BEACON = 'http://spec.openid.net/beacon/1.0/';
''' % (LICENSE)
    
    if not os.path.exists(EXPORT_PKG_DIR):
    	os.makedirs(EXPORT_PKG_DIR)
    saveFile = open(EXPORT_CONSTANTS, 'w')
    saveFile.write(content+'\n')
    saveFile.close()

    print 'Generated %s' % EXPORT_CONSTANTS

# Simple PHP file that tells Firefox what the latest version of the plugin is
def generateUpdatePhp(version, config):
    xpiLocation = config['xpi_server_path']
    phpText = \
'''<?php
header('Content-type: text/rdf');
echo '<?xml version="1.0"?>';
?>
<r:RDF xmlns:r="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://www.mozilla.org/2004/em-rdf#">
    <!-- Foo Widget Extension -->
    <r:Description about="urn:mozilla:extension:firefox.openid@vidoop.com">
        <updates>
            <r:Seq>
                <r:li>
                    <r:Description>
                        <version>%s</version>
                        <targetApplication>
                            <r:Description>
                                <id>{ec8030f7-c20a-464f-9b0e-13a3a9e97384}</id>
                                <minVersion>1.5</minVersion>
                                <maxVersion>2.0.0.*</maxVersion>
                                <updateLink>%s</updateLink>
                            </r:Description>
                        </targetApplication>
                    </r:Description>
                </r:li>
            </r:Seq>
        </updates>
        <version>%s</version>
        <updateLink>%s</updateLink>
    </r:Description>
</r:RDF>
''' % (version, xpiLocation, version, xpiLocation)
    if not os.path.exists(EXPORT_PKG_DIR):
    	os.makedirs(EXPORT_PKG_DIR)
    saveFile = open(EXPORT_PHP, 'w')
    saveFile.write(phpText)
    saveFile.close()
    print 'Generated %s' % EXPORT_PHP

def signXPI():
    pass

################################################################################
# Package logic
################################################################################
# This program can do one of the following:
# 1. Get the version of the plugin
# 2. Bump the version number and/or update the plugin
# 3. Set the version number and/or update the plugin
################################################################################

# Get the version number
if (options.getVersion == True):
    print 'The current version of the plugin is "%s"' % getVersion()
    sys.exit()

################################################################################

if options.setVersion != False and options.bumpVersion != False:
    print 'Either choose --set-version or --bump-version.'
    sys.exit()
#if options.setVersion == False and options.bumpVersion == False and options.update == False and options.signXPI == False:
#    print 'Use --help for usage.'
#    sys.exit()

exportVersion = getVersion()
if len(arguments) and arguments[0] in configSet:
    config = configSet[arguments[0]]
else:
    if options.bumpVersion == False and options.setVersion == False:
        print 'Please bump/set version or use this command with one of the following parameters:'
        print '\t',
        for key in configSet: 
            print key,
        sys.exit()

# Bump the version number
if options.bumpVersion == True:
    version = exportVersion.split('.')
    version[len(version) - 1] = str(int(version[len(version) - 1]) + 1)
    version = '.'.join(version)
    exportVersion = version
    print 'Bumped version to "%s"' % version

# Set the version number
if options.setVersion != False:
    exportVersion = options.setVersion
    print 'Setting version to "%s"' % options.setVersion

# Update version number in file
setVersion(exportVersion)

# always create generated files unless 
# a version param or help is invoked (above)
generateConstants(exportVersion, config)
generateInstallRdf(exportVersion, config)
generateUpdatePhp(exportVersion, config)

# Put all the manifest and generated files in package directory to zip up
def installFile(src, dest):
   # Make sure directories exist
   (path, _dummy) = os.path.split(dest)
   if not os.path.exists(path):
      os.makedirs(path)
   # Copy file there
   shutil.copy(src, dest)

# Copy file to export/package directory
shutil.rmtree(EXPORT_PKG_DIR, True)
installFile(EXPORT_INSTALL_RDF, os.path.join(EXPORT_PKG_DIR, 'install.rdf'))
installFile(EXPORT_CONSTANTS, os.path.join(EXPORT_PKG_DIR, 'content/constants.js'))
for filepath in MANIFEST:
   installFile(filepath, os.path.join(EXPORT_PKG_DIR, filepath))

# sign the plugin using the java-based xpisigner
# command and params defined above
if options.signXPI == True:
   password = raw_input("Please type the passphrase for the certificate file: ") 
   XPI_SIGNER_CMD = XPI_SIGNER_CMD.replace("password", password)
   # print XPI_SIGNER_CMD
   os.system(XPI_SIGNER_CMD)
# zip them up using zip utility
else:
    #We're going to save debug and stable as separate file names
    file_extra = ''
    if config['debug']:
       file_extra = '-debug'
    command = "cd %s && zip -r openid.xpi *" % EXPORT_PKG_DIR
    print 'Executing %s' % command
    commands.getstatusoutput(command)
    shutil.move(os.path.join(EXPORT_PKG_DIR, "openid.xpi"), EXPORT_PLUGIN)