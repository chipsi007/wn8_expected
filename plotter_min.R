#WN8 rSTAT Plotter by Gryphon

#plot function
require(ggplot2)
ggplotRegression <- function (fit, title) {
    ggplot(fit$model, aes_string(x = names(fit$model)[2], y = names(fit$model)[1])) + 
        geom_point() +
        stat_smooth(method = "lm", col = "red") +
        labs(title = paste(title,":", names(fit$model)[1], "=", round(fit$coef[[1]],2), "+", + round(fit$coef[[2]],2), "*", names(fit$model)[2],
                           "; Adj R2=", round(summary(fit)$adj.r.squared, 2)))
}

# run rSTATc vs user_rSTATc plots for all tanks
for (i in listOfTanks$compDescr){
    sample <- userTankStatsFiltered[userTankStatsFiltered$compDescr == i,]
######set model parameters###########
    model <- lm(rDAMAGEc ~ user_rDAMAGEc, data=sample)
#####################################
    jpegString <- paste("plots/", names(model$model)[1],"_vs_",names(model$model)[2], "_v31_%i.jpg")
    ggplotRegression(model, listOfTanks$title[listOfTanks$compDescr == i] )
    savedPlot <- sprintf(jpegString, listOfTanks$compDescr[listOfTanks$compDescr == i])
    ggsave(file=savedPlot, width=7, height=7)
}

# run WN8 vs user WN8 plots for all tanks
for (i in listOfTanks$compDescr){
    sample <- userTankStatsFiltered[userTankStatsFiltered$compDescr == i,]
    ######set model parameters###########
    model <- lm(WN8 ~ user_WN8, data=sample)
    #####################################
    jpegString <- paste("plots/", names(model$model)[1],"_vs_",names(model$model)[2], "_v31_%i.jpg")
    ggplotRegression(model, listOfTanks$title[listOfTanks$compDescr == i] )
    savedPlot <- sprintf(jpegString, listOfTanks$compDescr[listOfTanks$compDescr == i])
    ggsave(file=savedPlot, width=7, height=7)
}

# user_WN8 ~ user_rWINc for all accounts
usermodel <- lm(user_WN8 ~ user_rWINc, data=userAccountStats)
ggplot(usermodel$model, aes_string(x = names(usermodel$model)[2], y = names(usermodel$model)[1])) + 
    geom_point() +
    stat_smooth(method = "lm", col = "red", size = 1 ) +
    coord_cartesian(ylim = c(0, 3000), xlim = c(0,2)) + 
    geom_abline(intercept = 0, slope = 1565, col = "blue", size = 1) +
    labs(title = paste(names(usermodel$model)[1], "vs",names(usermodel$model)[2],"; Adj R2=", round(summary(usermodel)$adj.r.squared, 2)))
savedPlot <- paste("plots/",names(usermodel$model)[1],"vs", names(usermodel$model)[2],"_v31.jpg")
ggsave(file=savedPlot, width=7, height=7)
