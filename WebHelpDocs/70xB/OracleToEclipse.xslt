<?xml version="1.0" encoding="ISO-8859-1" ?>
<xsl:stylesheet id="OracleToEclipse" version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:param name="ShortName"/>
  <xsl:output method = "xml" indent="yes" />

  <xsl:template match="tocitem">
    <xsl:element name="topic">
      <xsl:attribute name="label"><xsl:value-of select="@text" /></xsl:attribute>
      <xsl:attribute name="href"><xsl:value-of select="$ShortName" />/<xsl:value-of select="substring(@target,2)" />.html</xsl:attribute>
      <xsl:apply-templates select="tocitem"/>
    </xsl:element>
  </xsl:template>

<!--<xsl:with-param name="ShortName"/> -->
  <xsl:template match="toc">
    <xsl:element name="toc">
      <!-- xsl:attribute name="xmlns:xhtml">http://www.w3.org/1999/xhtml</xsl:attribute -->
      <xsl:attribute name="label"><xsl:value-of select="$ShortName" />_toc.xml</xsl:attribute>
      <xsl:element name="topic">
         <xsl:attribute name="label"><xsl:value-of select="$ShortName" /></xsl:attribute>
         <xsl:for-each select="tocitem">
            <xsl:apply-templates select="tocitem"/>
         </xsl:for-each>
      </xsl:element>
    </xsl:element>
    </xsl:template>

</xsl:stylesheet>